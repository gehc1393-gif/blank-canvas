import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { StockBalance, StockIndicators, StockPanel } from "@/components/packaging-stock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listPackaging, readPackaging, savePackaging } from "@/lib/packaging.functions";
import {
  dimensionUnits,
  emptyPackaging,
  packagingCost,
  packagingSchema,
  useUnits,
  type PackagingRow,
} from "@/lib/packaging-schema";

const selectClass = "block w-full rounded-md border bg-white p-2";
const formatCost = (p: number, q: number) => {
  const cost = packagingCost(p, q);
  return cost
    ? "R$ " +
        cost
          .toNumber()
          .toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 10 })
    : "Custo não informado";
};
const dimFields = [
  ["width", "Largura"],
  ["height", "Altura"],
  ["depth", "Profundidade"],
] as const;
type ListRow = Awaited<ReturnType<typeof listPackaging>>["rows"][number];
type Panel =
  { mode: "new" } | { mode: "view" | "edit"; row: PackagingRow } | { mode: "status"; row: ListRow };

export function PackagingManager({ userId }: { userId: string }) {
  const list = useServerFn(listPackaging),
    read = useServerFn(readPackaging),
    save = useServerFn(savePackaging);
  const client = useQueryClient(),
    key = ["packaging", userId];
  const query = useQuery({ queryKey: key, queryFn: () => list() });
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("todos"),
    [category, setCategory] = useState("");
  const [stock, setStock] = useState<{ id: string; move: boolean } | null>(null);
  const stockItem = query.data?.rows.find((r) => r.id === stock?.id);
  const [panel, setPanel] = useState<Panel | null>(null),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [photo, setPhoto] = useState(""),
    [price, setPrice] = useState("0"),
    [quantity, setQuantity] = useState("1"),
    [unit, setUnit] = useState("unidade");
  const draft =
    panel && (panel.mode === "edit" || panel.mode === "view") ? panel.row : emptyPackaging;
  const view = panel?.mode === "view";
  function open(p: Panel) {
    setError("");
    setNotice("");
    setPanel(p);
    const values = p.mode === "view" || p.mode === "edit" ? p.row : emptyPackaging;
    setPhoto(values.photo);
    setPrice(String(values.purchase_price));
    setQuantity(String(values.purchase_quantity));
    setUnit(values.use_unit);
  }
  async function details(id: string, mode: "edit" | "view") {
    setBusy(true);
    setError("");
    try {
      open({ mode, row: await read({ data: id }) });
    } catch {
      setError("Falha ao consultar os detalhes.");
    } finally {
      setBusy(false);
    }
  }
  async function commit(data: NonNullable<Parameters<typeof save>[0]>["data"]) {
    setBusy(true);
    setError("");
    try {
      await save({ data });
      await client.invalidateQueries({ queryKey: key });
      setPanel(null);
      setNotice("Embalagem salva.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!panel || busy || (panel.mode !== "new" && panel.mode !== "edit")) return;
    const form = new FormData(e.currentTarget);
    const values = Object.fromEntries(form);
    const optional = (name: string) => (form.get(name) ? Number(form.get(name)) : null);
    const result = packagingSchema.safeParse({
      ...values,
      photo,
      active: draft.active,
      width: optional("width"),
      height: optional("height"),
      depth: optional("depth"),
      purchase_price: Number(price),
      purchase_quantity: Number(quantity),
      minimum: Number(form.get("minimum")),
    });
    if (!result.success) {
      setError(
        "Confira o campo " + (result.error.issues[0]?.path[0] ?? "") + " e a precisão dos valores.",
      );
      return;
    }
    void commit(
      panel.mode === "new"
        ? { action: "create", values: result.data }
        : {
            action: "edit",
            id: panel.row.id,
            updated_at: panel.row.updated_at,
            values: result.data,
          },
    );
  }
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const rows = query.data?.rows.filter(
    (r) =>
      (r.name.toLocaleLowerCase("pt-BR").includes(term) || r.code.toLowerCase().includes(term)) &&
      (!category || category === r.category) &&
      (status === "todos" || r.active === (status === "ativos")),
  );
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          aria-label="Pesquisar por nome ou código"
          placeholder="Pesquisar por nome ou código"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label="Filtrar categoria"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas as categorias</option>
          {query.data?.categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select
          aria-label="Filtrar situação"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
        <Button disabled={busy || !query.data} onClick={() => open({ mode: "new" })}>
          Nova Embalagem
        </Button>
      </div>
      {query.isPending && <p>Carregando embalagens…</p>}
      {query.isError && (
        <p role="alert">
          Falha ao carregar embalagens.{" "}
          <button onClick={() => query.refetch()}>Tentar novamente</button>
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {!panel && error && <p role="alert">{error}</p>}
      {query.data && <StockIndicators rows={query.data.rows} userId={userId} />}
      {rows?.length === 0 && <p>Nenhuma embalagem encontrada.</p>}
      {rows?.map((r) => (
        <article
          key={r.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"
        >
          <div className="min-w-0 break-words">
            <strong>
              {r.code} · {r.name}
            </strong>
            <p>
              {r.category} · {r.active ? "Ativa" : "Inativa"}
            </p>
            <p>
              {formatCost(r.purchase_price, r.purchase_quantity)}
              {r.purchase_price > 0 && " / " + r.use_unit}
            </p>
          </div>
          <StockBalance item={r} />
          <div className="flex flex-wrap gap-2">
            {r.active && (
              <Button variant="outline" onClick={() => setStock({ id: r.id, move: true })}>
                Movimentar Estoque
              </Button>
            )}
            <Button variant="outline" onClick={() => setStock({ id: r.id, move: false })}>
              Histórico de Estoque
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => details(r.id, "view")}>
              Visualizar
            </Button>
            <Button disabled={busy} variant="outline" onClick={() => details(r.id, "edit")}>
              Editar
            </Button>
            <Button
              disabled={busy}
              variant="outline"
              onClick={() => open({ mode: "status", row: r })}
            >
              {r.active ? "Inativar" : "Reativar"}
            </Button>
          </div>
        </article>
      ))}
      <Dialog
        open={!!panel}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setPanel(null);
            setError("");
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {panel?.mode === "status"
                ? panel.row.active
                  ? "Inativar embalagem"
                  : "Reativar embalagem"
                : view
                  ? "Detalhes da embalagem"
                  : panel?.mode === "edit"
                    ? "Editar embalagem"
                    : "Nova Embalagem"}
            </DialogTitle>
          </DialogHeader>
          {panel?.mode === "status" ? (
            <>
              <p>Confirmar a alteração de situação de {panel.row.name}?</p>
              <Button
                disabled={busy}
                onClick={() =>
                  commit({
                    action: "status",
                    id: panel.row.id,
                    updated_at: panel.row.updated_at,
                    active: !panel.row.active,
                  })
                }
              >
                Confirmar
              </Button>
            </>
          ) : (
            panel && (
              <form onSubmit={submit}>
                <fieldset disabled={view || busy} className="grid gap-3 sm:grid-cols-2">
                  <label>
                    Código interno
                    <Input required name="code" maxLength={48} defaultValue={draft.code} />
                  </label>
                  <label>
                    Nome
                    <Input required name="name" maxLength={160} defaultValue={draft.name} />
                  </label>
                  <label>
                    Categoria
                    <select
                      required
                      className={selectClass}
                      name="category"
                      defaultValue={draft.category}
                    >
                      <option value="">Selecione</option>
                      {query.data?.categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Material
                    <Input name="material" maxLength={160} defaultValue={draft.material} />
                  </label>
                  <label>
                    Descrição
                    <textarea
                      className={selectClass}
                      name="description"
                      maxLength={3000}
                      defaultValue={draft.description}
                    />
                  </label>
                  <label>
                    Observações
                    <textarea
                      className={selectClass}
                      name="notes"
                      maxLength={3000}
                      defaultValue={draft.notes}
                    />
                  </label>
                  {dimFields.map(([k, label]) => (
                    <label key={k}>
                      {label}
                      <Input
                        name={k}
                        type="number"
                        step="0.0001"
                        min="0.0001"
                        defaultValue={draft[k] ?? ""}
                      />
                    </label>
                  ))}
                  <label>
                    Unidade das dimensões
                    <select
                      className={selectClass}
                      name="dimension_unit"
                      defaultValue={draft.dimension_unit}
                    >
                      {dimensionUnits.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Unidade de utilização
                    <select
                      className={selectClass}
                      name="use_unit"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    >
                      {useUnits.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantidade por compra ({unit})
                    <Input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      required
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                  <label>
                    Preço da compra (R$)
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </label>
                  <label>
                    Estoque mínimo ({unit})
                    <Input
                      name="minimum"
                      type="number"
                      step="0.0001"
                      min="0"
                      required
                      defaultValue={draft.minimum}
                    />
                  </label>
                  <p className="sm:col-span-2">
                    Custo por {unit}: {formatCost(Number(price), Number(quantity))}
                  </p>
                  {!view && (
                    <label>
                      Fotografia opcional (PNG, JPEG ou WebP, até 250 KB)
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (
                            file.size > 250 * 1024 ||
                            !["image/png", "image/jpeg", "image/webp"].includes(file.type)
                          ) {
                            setError("Selecione PNG, JPEG ou WebP de até 250 KB.");
                            return;
                          }
                          const reader = new FileReader();
                          setBusy(true);
                          reader.onload = () => {
                            setPhoto(String(reader.result));
                            setError("");
                          };
                          reader.onerror = () => setError("Falha ao ler a fotografia.");
                          reader.onloadend = () => setBusy(false);
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  )}
                  {photo && (
                    <div>
                      <img
                        src={photo}
                        alt="Fotografia da embalagem"
                        className="max-h-36 max-w-full"
                      />
                      {!view && (
                        <button type="button" onClick={() => setPhoto("")}>
                          Remover foto
                        </button>
                      )}
                    </div>
                  )}
                </fieldset>
                {panel.mode !== "new" && (
                  <p className="my-3 text-sm">
                    {draft.active ? "Ativa" : "Inativa"} · Cadastro em{" "}
                    {new Date(panel.row.created_at).toLocaleString("pt-BR")} · Atualizada em{" "}
                    {new Date(panel.row.updated_at).toLocaleString("pt-BR")}
                  </p>
                )}
                {!view && (
                  <Button className="mt-4" disabled={busy}>
                    Salvar embalagem
                  </Button>
                )}
              </form>
            )
          )}
          {panel?.mode === "view" && (
            <StockPanel item={panel.row} userId={userId} allowMove={false} />
          )}
          {error && <p role="alert">{error}</p>}
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!stockItem}
        onOpenChange={(v) => {
          if (!v) setStock(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{stockItem?.name}</DialogTitle>
          </DialogHeader>
          {stockItem && (
            <StockPanel
              key={stockItem.id}
              item={stockItem}
              userId={userId}
              allowMove={!!stock?.move}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
