import { useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PackagingRow } from "@/lib/packaging-schema";
import { countStock, moveStock, stockHistory } from "@/lib/packaging-stock.functions";

type Item = Pick<
  PackagingRow,
  "id" | "name" | "use_unit" | "minimum" | "stock_balance" | "last_stock_at" | "active"
>;
const labels = { entrada: "Entrada", saida: "Saída", perda: "Perda", ajuste: "Ajuste" } as const;
type Kind = keyof typeof labels;
const kinds = Object.keys(labels) as Kind[];
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const qty = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const situation = (i: Item) =>
  i.stock_balance === 0
    ? "Estoque zerado"
    : i.stock_balance <= i.minimum
      ? "Estoque baixo"
      : "Estoque normal";
export function StockBalance({ item }: { item: Item }) {
  return (
    <div>
      <p>
        Saldo físico: {qty(item.stock_balance)} {item.use_unit} · Mínimo: {qty(item.minimum)}{" "}
        {item.use_unit}
      </p>
      <p>
        {situation(item)} ·{" "}
        {item.last_stock_at
          ? "Última movimentação: " + new Date(item.last_stock_at).toLocaleString("pt-BR")
          : "Sem movimentações"}
      </p>
    </div>
  );
}
export function StockIndicators({ rows, userId }: { rows: Item[]; userId: string }) {
  const end = today();
  const [from, setFrom] = useState(end.slice(0, 7) + "-01"),
    [to, setTo] = useState(end);
  const load = useServerFn(countStock);
  const valid = !!from && !!to && from <= to;
  const count = useQuery({
    queryKey: ["pack-count", userId, from, to],
    queryFn: () => load({ data: { from, to } }),
    enabled: valid,
  });
  return (
    <section className="space-y-2 rounded-lg border bg-white p-4">
      <p>
        Total de embalagens: {rows.length} · Estoque baixo:{" "}
        {rows.filter((i) => situation(i) === "Estoque baixo").length} · Sem estoque:{" "}
        {rows.filter((i) => i.stock_balance === 0).length}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label>
          Período de
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Até
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <span>
          Movimentações do período:{" "}
          {!valid ? "Período inválido" : count.isError ? "Falha na consulta" : (count.data ?? "…")}
        </span>
      </div>
    </section>
  );
}
export function StockPanel({
  item,
  userId,
  allowMove,
}: {
  item: Item;
  userId: string;
  allowMove: boolean;
}) {
  const client = useQueryClient(),
    load = useServerFn(stockHistory),
    save = useServerFn(moveStock);
  const [kind, setKind] = useState<Kind>("entrada"),
    [amount, setAmount] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [filter, setFilter] = useState<Kind | "">(""),
    [page, setPage] = useState(0);
  const request = useRef({ id: "", signature: "" });
  const history = useQuery({
    queryKey: ["pack-history", userId, item.id, from, to, filter, page],
    queryFn: () =>
      load({
        data: {
          item: item.id,
          from: from || undefined,
          to: to || undefined,
          kind: filter || undefined,
          page,
        },
      }),
  });
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget,
      values = new FormData(form);
    const data = {
      p_item: item.id,
      p_kind: kind,
      p_quantity: Number(amount),
      p_unit: item.use_unit,
      p_date: String(values.get("date")),
      p_reason: String(values.get("reason")),
      p_notes: String(values.get("notes")),
      p_expected: kind === "ajuste" ? item.stock_balance : null,
    };
    const signature = JSON.stringify(data);
    if (signature !== request.current.signature)
      request.current = { id: crypto.randomUUID(), signature };
    setBusy(true);
    setMessage("");
    try {
      await save({ data: { ...data, p_operation: request.current.id } });
      request.current = { id: "", signature: "" };
      form.reset();
      setAmount("");
      setPage(0);
      setMessage("Movimentação registrada.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao movimentar.");
    } finally {
      await Promise.all(
        [
          ["packaging", userId],
          ["pack-count", userId],
          ["pack-history", userId, item.id],
        ].map((queryKey) => client.invalidateQueries({ queryKey })),
      );
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4">
      <StockBalance item={item} />
      {allowMove && item.active && (
        <form onSubmit={submit}>
          <fieldset disabled={busy} className="grid gap-2 sm:grid-cols-2">
            <label>
              Movimento
              <select
                className="block w-full rounded border p-2"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as Kind);
                  setMessage("");
                }}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {labels[k]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {kind === "ajuste" ? "Quantidade contada" : "Quantidade"} ({item.use_unit})
              <Input
                required
                type="number"
                min={kind === "ajuste" ? 0 : item.use_unit === "unidade" ? 1 : 0.0001}
                step={item.use_unit === "unidade" ? 1 : 0.0001}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Data
              <Input name="date" required type="date" defaultValue={today()} max={today()} />
            </label>
            <label>
              Motivo ou origem
              <Input name="reason" required maxLength={300} />
            </label>
            <label>
              Observações
              <Input name="notes" maxLength={2000} />
            </label>
            {kind === "ajuste" && amount !== "" && (
              <p>
                Diferença: {qty(Number(amount) - item.stock_balance)} {item.use_unit}
              </p>
            )}
            <p>Responsável: usuário conectado</p>
            <Button>Registrar {labels[kind]}</Button>
          </fieldset>
        </form>
      )}
      {message && <p role="status">{message}</p>}
      <h3 className="font-semibold">Histórico de Estoque</h3>
      <div className="flex flex-wrap gap-2">
        <label>
          Desde
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Até
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Tipo
          <select
            className="block rounded border p-2"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as Kind | "");
              setPage(0);
            }}
          >
            <option value="">Todos</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {labels[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {history.isPending && <p>Carregando histórico…</p>}
      {history.isError && <p role="alert">Falha ao carregar histórico.</p>}
      {history.data?.rows.length === 0 && <p>Nenhuma movimentação no período.</p>}
      {history.data?.rows.map((r) => (
        <article key={r.operation_id} className="break-words rounded border p-3 text-sm">
          <strong>
            {labels[r.kind]} · {qty(r.quantity)} {r.unit}
          </strong>
          <p>
            {r.movement_date.split("-").reverse().join("/")} · Registrado em{" "}
            {new Date(r.recorded_at).toLocaleString("pt-BR")}
          </p>
          <p>
            Saldo: {qty(r.previous_balance)} → {qty(r.new_balance)} {r.unit} · Diferença:{" "}
            {qty(r.new_balance - r.previous_balance)}
          </p>
          <p>
            {r.reason} {r.notes}
          </p>
          <p>Responsável: {r.responsible === userId ? "Você" : r.responsible}</p>
          <p>Operação: {r.operation_id}</p>
        </article>
      ))}
      {page > 0 && (
        <Button variant="outline" onClick={() => setPage(page - 1)}>
          Anterior
        </Button>
      )}
      {history.data?.more && (
        <Button variant="outline" onClick={() => setPage(page + 1)}>
          Próxima
        </Button>
      )}
    </section>
  );
}
