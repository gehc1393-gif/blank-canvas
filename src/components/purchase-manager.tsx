import {
  expectedReceipt,
  receivable,
  pendingOrder,
  lateOrder,
  purchaseToday,
  purchaseSummary,
  purchaseStatuses,
} from "@/lib/purchase-report";
import { PurchaseReceipts } from "@/components/purchase-receipts";
import Decimal from "decimal.js";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRecipeMaterials } from "@/lib/recipe.functions";
import { listPackaging } from "@/lib/packaging.functions";
import { listSuppliers } from "@/lib/supplier.functions";
import { compatibleUnits } from "@/lib/recipe-schema";
import {
  changePurchase,
  purchaseList,
  purchaseQuote,
  type Order,
  type PurchaseRequest,
} from "@/lib/purchase.functions";

const currency = (value: Decimal | number) =>
  "R$ " + new Decimal(value).toFixed(2).replace(".", ",");
const select = "w-full rounded-md border bg-white p-2";
const emptyItem: PurchaseRequest["items"][number] = {
  kind: "ingrediente",
  id: "",
  qty: 1,
  content: 1,
  price: 0,
  buy_unit: "",
  content_unit: "",
};
function draft(order?: Order): PurchaseRequest {
  return {
    id: order?.id ?? crypto.randomUUID(),
    operation: "",
    revision: order?.revision ?? 0,
    action: "salvar",
    supplier: order?.supplier_id ?? "",
    date:
      order?.ordered_on ??
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()),
    delivery: order?.delivery_on ?? "",
    notes: order?.notes ?? "",
    discount: order?.discount ?? 0,
    freight: order?.freight ?? 0,
    items: order?.items ?? [{ ...emptyItem }],
  };
}
export function PurchaseManager({
  userId,
  onStockChanged,
}: {
  userId: string;
  onStockChanged: () => void;
}) {
  const client = useQueryClient(),
    key = ["purchase", userId];
  const list = useServerFn(purchaseList),
    save = useServerFn(changePurchase),
    quotes = useServerFn(purchaseQuote);
  const suppliers = useServerFn(listSuppliers),
    materials = useServerFn(listRecipeMaterials),
    packaging = useServerFn(listPackaging);
  const orders = useQuery({ queryKey: key, queryFn: () => list() });
  const vendors = useQuery({ queryKey: ["suppliers", userId], queryFn: () => suppliers() });
  const ingredients = useQuery({
    queryKey: ["purchase-materials", userId],
    queryFn: () => materials(),
  });
  const packages = useQuery({ queryKey: ["packaging", userId], queryFn: () => packaging() });
  const [form, setForm] = useState<PurchaseRequest | null>(null),
    [selected, setSelected] = useState<Order | null>(null);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [cancel, setCancel] = useState(false),
    [reason, setReason] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [sort, setSort] = useState("number");
  const today = purchaseToday();
  const operation = useRef({ signature: "", id: "" });
  const vendor = vendors.data?.find((v) => v.id === form?.supplier);
  function open(order?: Order, edit = false) {
    setSelected(order ?? null);
    setForm(!order || edit ? draft(order) : null);
    setCancel(false);
    setReason("");
    setMessage("");
  }
  async function commit(data: PurchaseRequest) {
    if (busy) return;
    if (data.action === "emitir") {
      for (const line of data.items) {
        const material =
          line.kind === "ingrediente"
            ? ingredients.data?.find((item) => item.id === line.id)
            : packages.data?.rows.find((item) => item.id === line.id);
        const unit = material && ("unit" in material ? material.unit : material.use_unit);
        const quantity = unit
          ? expectedReceipt(line.qty, line.content, line.content_unit, unit)
          : null;
        if (material && unit && quantity && !receivable(quantity, unit)) {
          setMessage(
            `${material.name}: ${quantity} ${unit} não pode ser recebido exatamente. Ajuste a quantidade antes de emitir.`,
          );
          return;
        }
      }
    }
    const signature = JSON.stringify(data);
    if (operation.current.signature !== signature)
      operation.current = { signature, id: crypto.randomUUID() };
    setBusy(true);
    setMessage("");
    try {
      await save({ data: { ...data, operation: operation.current.id } });
      await client.invalidateQueries({ queryKey: key });
      setSelected(null);
      setForm(null);
      setCancel(false);
      setMessage("Pedido atualizado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao gravar.");
    } finally {
      setBusy(false);
    }
  }
  const subtotal = form?.items.reduce(
    (sum, line) => sum.plus(new Decimal(line.qty).times(line.price)),
    new Decimal(0),
  );
  const update = (i: number, values: Partial<PurchaseRequest["items"][number]>) => {
    if (form)
      setForm({ ...form, items: form.items.map((x, j) => (i === j ? { ...x, ...values } : x)) });
  };
  const filtered = orders.data?.filter(
    (o) =>
      (String(o.number).includes(search.trim()) ||
        o.supplier_name.toLowerCase().includes(search.trim().toLowerCase())) &&
      (!supplierFilter || o.supplier_id === supplierFilter) &&
      (!status || (status === "atrasados" ? lateOrder(o, today) : o.status === status)) &&
      (!from || o.ordered_on >= from) &&
      (!to || o.ordered_on <= to),
  );
  const visible = filtered ?? [];
  const summary = purchaseSummary(visible, today);
  const vendorOptions = new Map(orders.data?.map((o) => [o.supplier_id, o.supplier_name]));
  const ordered = [...visible].sort((a, b) => {
    if (sort === "ordered_on")
      return b.ordered_on.localeCompare(a.ordered_on) || b.number - a.number;
    if (sort === "delivery_on")
      return (
        (a.delivery_on ?? "9999").localeCompare(b.delivery_on ?? "9999") || b.number - a.number
      );
    if (sort === "status") return a.status.localeCompare(b.status) || b.number - a.number;
    return b.number - a.number;
  });
  const suppliersSummary = visible.reduce((groups, o) => {
    const group = groups.get(o.supplier_id) ?? [];
    group.push(o);
    groups.set(o.supplier_id, group);
    return groups;
  }, new Map<string, Order[]>());
  return (
    <section className="space-y-4">
      {message && <p role="status">{message}</p>}
      {(orders.isError || vendors.isError || ingredients.isError || packages.isError) && (
        <p role="alert">
          Falha ao carregar dados de compras. Atualize a página para tentar novamente.
        </p>
      )}
      {!selected && !form ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label>
              Pesquisa
              <Input
                placeholder="Número ou fornecedor"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Situação
              <select className={select} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todas</option>
                <option value="atrasados">Atrasados</option>
                {["rascunho", "emitido", "parcialmente recebido", "recebido", "cancelado"].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s === "emitido" ? "Aguardando recebimento" : s}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label>
              De
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              Até
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <label>
              Fornecedor
              <select
                className={select}
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {Array.from(vendorOptions, ([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Ordenar por
              <select className={select} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="number">Número</option>
                <option value="ordered_on">Data do pedido</option>
                <option value="delivery_on">Previsão de entrega</option>
                <option value="status">Situação</option>
              </select>
            </label>
            <Button onClick={() => open()}>Novo Pedido</Button>
          </div>
          {orders.isPending && <p>Carregando pedidos…</p>}
          {filtered?.length === 0 && <p>Nenhum pedido encontrado.</p>}
          {orders.data && (
            <section className="space-y-2 rounded border bg-white p-4">
              <h3 className="font-semibold">Indicadores de compras</h3>
              <p>
                Total de pedidos: {visible.length} · Atrasados: {summary.late}
              </p>
              <ul className="flex flex-wrap gap-3">
                {purchaseStatuses.map((s) => (
                  <li key={s}>
                    {s === "emitido" ? "Aguardando recebimento" : s}: {summary.count(s)}
                  </li>
                ))}
              </ul>
              <p>
                Emitidos e não cancelados: {currency(summary.issued)} · Pendentes:{" "}
                {currency(summary.pending)} · Concluídos: {currency(summary.completed)} ·
                Cancelados: {currency(summary.cancelled)}
              </p>
              <p className="text-sm">
                Valores contratados. Pagamentos não são contabilizados neste painel.
              </p>
              <details>
                <summary>Resumo por fornecedor</summary>
                <ul>
                  {Array.from(suppliersSummary, ([id, rows]) => {
                    const totals = purchaseSummary(rows, today);
                    const latest = rows
                      .filter((o) => o.issued_at)
                      .map((o) => o.ordered_on)
                      .sort()
                      .at(-1);
                    return (
                      <li key={id} className="break-words border-t py-2">
                        {vendorOptions.get(id)} · {rows.length} pedidos · Contratado{" "}
                        {currency(totals.issued)} · {rows.filter(pendingOrder).length} pendentes ·{" "}
                        {totals.count("recebido")} concluídos · {totals.count("cancelado")}{" "}
                        cancelados · Última compra: {latest ?? "—"}
                      </li>
                    );
                  })}
                </ul>
              </details>
            </section>
          )}
          {ordered.map((o) => (
            <article
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4"
              key={o.id}
            >
              <span>
                #{o.number} · {o.supplier_name} · {o.ordered_on} · {o.status} · {currency(o.total)}
                {lateOrder(o, today)
                  ? " · Entrega atrasada"
                  : pendingOrder(o)
                    ? " · Recebimento pendente"
                    : ""}
              </span>
              <Button variant="outline" onClick={() => open(o)}>
                Visualizar
              </Button>
            </article>
          ))}
        </>
      ) : (
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setSelected(null);
              setForm(null);
              setCancel(false);
              setMessage("");
            }}
          >
            Voltar à listagem
          </Button>
          {form ? (
            <form
              className="space-y-4 rounded-lg border bg-white p-4"
              onSubmit={(e) => {
                e.preventDefault();
                const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
                void commit({
                  ...form,
                  action: submitter?.value === "emitir" ? "emitir" : "salvar",
                });
              }}
            >
              <fieldset disabled={busy} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    Fornecedor
                    <select
                      required
                      className={select}
                      value={form.supplier}
                      onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                    >
                      <option value="">Selecione</option>
                      {vendors.data
                        ?.filter((v) => v.active || v.id === selected?.supplier_id)
                        .map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  {vendor && (
                    <p>
                      {vendor.name} · {vendor.trade_name || "Sem nome fantasia"} ·{" "}
                      {vendor.contact || "Sem contato"} ·{" "}
                      {vendor.phone || vendor.whatsapp || "Sem telefone"} ·{" "}
                      {vendor.active ? "Ativo" : "Inativo"}
                    </p>
                  )}
                  <label>
                    Data do pedido
                    <Input
                      type="date"
                      required
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                  </label>
                  <label>
                    Previsão de entrega
                    <Input
                      type="date"
                      min={form.date}
                      value={form.delivery}
                      onChange={(e) => setForm({ ...form, delivery: e.target.value })}
                    />
                  </label>
                  <label>
                    Observações
                    <textarea
                      className={select}
                      maxLength={4000}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </label>
                </div>
                <h3 className="font-semibold">Itens do pedido</h3>
                {form.items.map((line, i) => {
                  const catalog =
                    line.kind === "ingrediente"
                      ? ingredients.data?.map((m) => ({
                          id: m.id,
                          name: m.name,
                          code: m.id,
                          unit: m.unit,
                        }))
                      : packages.data?.rows
                          .filter((p) => p.active)
                          .map((p) => ({ id: p.id, name: p.name, code: p.code, unit: p.use_unit }));
                  const material = catalog?.find((m) => m.id === line.id);
                  const receipt = material
                    ? expectedReceipt(line.qty, line.content, line.content_unit, material.unit)
                    : null;
                  return (
                    <div className="grid gap-3 rounded border p-3 sm:grid-cols-2" key={i}>
                      <label>
                        Tipo
                        <select
                          className={select}
                          value={line.kind}
                          onChange={(e) =>
                            update(i, { ...emptyItem, kind: e.target.value as typeof line.kind })
                          }
                        >
                          <option value="ingrediente">Ingrediente</option>
                          <option value="embalagem">Embalagem</option>
                        </select>
                      </label>
                      <label>
                        Material
                        <select
                          required
                          className={select}
                          value={line.id}
                          onChange={(e) =>
                            update(i, {
                              id: e.target.value,
                              content_unit:
                                catalog?.find((m) => m.id === e.target.value)?.unit ?? "",
                            })
                          }
                        >
                          <option value="">Selecione</option>
                          {catalog?.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.code} · {m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Unidade de compra
                        <Input
                          required
                          maxLength={40}
                          value={line.buy_unit}
                          onChange={(e) => update(i, { buy_unit: e.target.value })}
                        />
                      </label>
                      <label>
                        Unidade do conteúdo
                        <select
                          required
                          className={select}
                          value={line.content_unit}
                          onChange={(e) => update(i, { content_unit: e.target.value })}
                        >
                          <option value="">Selecione</option>
                          {material &&
                            compatibleUnits(material.unit).map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </label>
                      {(
                        [
                          ["qty", "Quantidade solicitada", "0.0001"],
                          ["content", "Conteúdo por unidade de compra", "0.0001"],
                          ["price", "Preço por unidade de compra (R$)", "0.01"],
                        ] as const
                      ).map(([field, label, step]) => (
                        <label key={field}>
                          {label}
                          <Input
                            required
                            type="number"
                            step={step}
                            min={field === "price" ? 0 : step}
                            value={line[field]}
                            onChange={(e) => update(i, { [field]: Number(e.target.value) })}
                          />
                        </label>
                      ))}
                      <p>
                        Previsto: {receipt?.toString() ?? "—"} {material?.unit} · Total:{" "}
                        {currency(new Decimal(line.qty).times(line.price))}
                      </p>
                      {receipt && material && !receivable(receipt, material.unit) && (
                        <p role="alert" className="text-red-800">
                          {material.name}: ajuste a quantidade prevista de {receipt.toString()}{" "}
                          {material.unit} para um valor recebível (até quatro casas decimais ou
                          inteiro para unidade/pacote).
                        </p>
                      )}
                      {line.kind === "ingrediente" && line.id && vendor && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const quote = await quotes({
                                data: { supplier: vendor.id, material: line.id },
                              });
                              setMessage(
                                quote
                                  ? `Cotação de ${quote.quoted_on}: ${currency(quote.package_price)} por ${quote.package_quantity} ${quote.unit}.`
                                  : "Nenhuma cotação encontrada.",
                              );
                            } catch {
                              setMessage("Falha ao consultar cotação.");
                            }
                          }}
                        >
                          Consultar cotação
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setForm({ ...form, items: form.items.filter((_, j) => i !== j) })
                        }
                      >
                        Remover item
                      </Button>
                    </div>
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  disabled={form.items.length >= 200}
                  onClick={() => setForm({ ...form, items: [...form.items, { ...emptyItem }] })}
                >
                  Adicionar item
                </Button>
                <div className="grid gap-3 sm:grid-cols-2">
                  {(["discount", "freight"] as const).map((field) => (
                    <label key={field}>
                      {field === "discount" ? "Desconto" : "Frete"}
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form[field]}
                        onChange={(e) => setForm({ ...form, [field]: Number(e.target.value) })}
                      />
                    </label>
                  ))}
                </div>
                <p>
                  Subtotal: {currency(subtotal ?? 0)} · Total:{" "}
                  {currency((subtotal ?? new Decimal(0)).minus(form.discount).plus(form.freight))}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!form.items.length} value="salvar">
                    Salvar rascunho
                  </Button>
                  <Button disabled={!form.items.length} value="emitir">
                    Emitir pedido
                  </Button>
                </div>
              </fieldset>
            </form>
          ) : (
            selected && (
              <article className="space-y-3 rounded border bg-white p-4">
                <h3>
                  Pedido #{selected.number} · {selected.status}
                </h3>
                <p>
                  {selected.supplier_name} · {selected.ordered_on} · Entrega:{" "}
                  {selected.delivery_on ?? "Sem previsão"}
                </p>
                <p>{selected.notes}</p>
                <p className="break-all">
                  Criado por {selected.created_by} em {selected.created_at} · Atualizado em{" "}
                  {selected.updated_at}
                </p>
                {selected.issued_at && (
                  <p className="break-all">
                    Emitido em {selected.issued_at} por {selected.issued_by}
                  </p>
                )}
                {selected.issued_at && (
                  <PurchaseReceipts
                    key={selected.id}
                    order={selected}
                    userId={userId}
                    onReload={async () => {
                      onStockChanged();
                      const result = await orders.refetch();
                      const updated = result.data?.find((o) => o.id === selected.id);
                      if (updated) setSelected(updated);
                    }}
                  />
                )}
                {selected.cancelled_at && (
                  <p>
                    Cancelado em {selected.cancelled_at} · {selected.cancellation_reason}
                  </p>
                )}
                <ul className="space-y-2">
                  {selected.items.map((line, i) => (
                    <li key={i}>
                      {line.kind} · {line.code} · {line.name} · {line.qty} {line.buy_unit} ×{" "}
                      {line.content} {line.content_unit} · Previsto {line.receipt} {line.stock_unit}{" "}
                      · {currency(line.price)} por {line.buy_unit} · Total {currency(line.total)}
                    </li>
                  ))}
                </ul>
                <p>
                  Subtotal {currency(selected.subtotal)} · Frete {currency(selected.freight)} ·
                  Desconto {currency(selected.discount)} · Total {currency(selected.total)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {selected.status === "rascunho" && (
                    <Button onClick={() => open(selected, true)}>Editar rascunho</Button>
                  )}
                  {["rascunho", "emitido"].includes(selected.status) && (
                    <Button variant="outline" onClick={() => setCancel(true)}>
                      Cancelar pedido
                    </Button>
                  )}
                </div>
                {cancel && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void commit({ ...draft(selected), action: "cancelar", reason });
                    }}
                  >
                    <label>
                      Motivo do cancelamento
                      <Input
                        value={reason}
                        required
                        maxLength={500}
                        onChange={(e) => setReason(e.target.value)}
                      />
                    </label>
                    <Button disabled={busy}>Confirmar cancelamento</Button>
                  </form>
                )}
              </article>
            )
          )}
        </>
      )}
    </section>
  );
}
