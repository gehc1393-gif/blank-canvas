import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowUpRight, CircleDollarSign, ClipboardList, Plus, ReceiptText, Tag } from "lucide-react";

import { useBusinessStore } from "@/lib/business-store";

type Material = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minimum: number;
  unitCost: number;
};

type RecipeItem = { materialId: string; quantity: number };
type Product = {
  id: string;
  name: string;
  batchYield: number;
  recipe: RecipeItem[];
  producedUnits: number;
  createdAt: string;
};
type Sale = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  soldAt: string;
};
type Expense = {
  id: string;
  description: string;
  category: string;
  amount: number;
  spentAt: string;
};
type SaleDraft = { productId: string; quantity: string; unitPrice: string };
type ExpenseDraft = { description: string; category: string; amount: string; spentAt: string };
type ManagerMode = "vendas" | "financeiro";

const expenseCategories = ["Ingredientes", "Embalagens", "Produção", "Entrega", "Equipamentos", "Outros"];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export function SalesFinanceManager({ mode }: { mode: ManagerMode }) {
  const { data, commit } = useBusinessStore();
  const { products, materials, sales, expenses, prices } = data;
  const ready = true;
  const [saleDraft, setSaleDraft] = useState<SaleDraft>({ productId: "", quantity: "1", unitPrice: "" });
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>({ description: "", category: "Outros", amount: "", spentAt: today() });
  const [message, setMessage] = useState("");

  const materialsById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials],
  );
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const soldByProduct = useMemo(() => {
    const totals = new Map<string, number>();
    for (const sale of sales) totals.set(sale.productId, (totals.get(sale.productId) ?? 0) + sale.quantity);
    return totals;
  }, [sales]);

  function productUnitCost(product: Product) {
    return product.recipe.reduce((total, item) => {
      const material = materialsById.get(item.materialId);
      return total + (material ? material.unitCost * item.quantity : 0);
    }, 0) / product.batchYield;
  }

  function priceFor(product: Product) {
    return prices[product.id] ?? Number((productUnitCost(product) * 2.5).toFixed(2));
  }

  const totalRevenue = sales.reduce((total, sale) => total + sale.quantity * sale.unitPrice, 0);
  const costOfSales = sales.reduce((total, sale) => total + sale.quantity * sale.unitCost, 0);
  const totalExpenses = expenses.reduce((total, expense) => total + expense.amount, 0);
  const netProfit = totalRevenue - costOfSales - totalExpenses;
  const sortedSales = [...sales].sort((first, second) => second.soldAt.localeCompare(first.soldAt));
  const sortedExpenses = [...expenses].sort((first, second) => second.spentAt.localeCompare(first.spentAt));

  async function registerSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = productsById.get(saleDraft.productId);
    const quantity = Number(saleDraft.quantity);
    const unitPrice = Number(saleDraft.unitPrice);
    if (!product || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      setMessage("Escolha um produto e informe uma quantidade e um preço válidos.");
      return;
    }
    const available = product.producedUnits - (soldByProduct.get(product.id) ?? 0);
    if (quantity > available) {
      setMessage(`Estoque insuficiente de ${product.name}: há ${Math.max(available, 0)} unidade(s) disponível(is). Registre uma produção antes da venda.`);
      return;
    }
    const sale: Sale = {
      id: makeId(),
      productId: product.id,
      quantity,
      unitPrice,
      unitCost: productUnitCost(product),
      soldAt: new Date().toISOString(),
    };
    if (!await commit({ ...data, sales: [sale, ...sales] })) return;
    setSaleDraft({ productId: "", quantity: "1", unitPrice: "" });
    setMessage(`Venda de ${quantity} unidade(s) de ${product.name} registrada.`);
  }

  async function registerExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(expenseDraft.amount);
    if (!expenseDraft.description.trim() || !Number.isFinite(amount) || amount <= 0 || !expenseDraft.spentAt) {
      setMessage("Informe uma descrição, uma data e um valor maior que zero para a despesa.");
      return;
    }
    const expense: Expense = {
      id: makeId(),
      description: expenseDraft.description.trim(),
      category: expenseDraft.category,
      amount,
      spentAt: expenseDraft.spentAt,
    };
    if (!await commit({ ...data, expenses: [expense, ...expenses] })) return;
    setExpenseDraft({ description: "", category: "Outros", amount: "", spentAt: today() });
    setMessage("Despesa registrada.");
  }

  async function updatePrice(productId: string, value: string) {
    const price = Number(value);
    if (Number.isFinite(price) && price >= 0) await commit({ ...data, prices: { ...prices, [productId]: price } });
  }

  return (
    <section className="space-y-5" aria-labelledby="sales-finance-title">
      <div>
        <span className="eyebrow">{mode === "vendas" ? "PEDIDOS E FATURAMENTO" : "PREÇOS, CUSTOS E RESULTADOS"}</span>
        <h2 id="sales-finance-title" className="mt-2 font-serif text-2xl font-medium text-[#4a3c33]">
          {mode === "vendas" ? "Vendas" : "Controle financeiro"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#897d72]">
          {mode === "vendas"
            ? "Registre as vendas dos produtos já produzidos e acompanhe o saldo disponível para venda."
            : "Defina preços com base no custo das receitas e acompanhe faturamento, custos e despesas."}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Faturamento registrado" value={ready ? formatCurrency(totalRevenue) : "—"} icon={<ArrowUpRight size={18} />} />
        <SummaryCard label="Custo dos produtos vendidos" value={ready ? formatCurrency(costOfSales) : "—"} icon={<Tag size={18} />} />
        <SummaryCard label="Despesas registradas" value={ready ? formatCurrency(totalExpenses) : "—"} icon={<ReceiptText size={18} />} />
        <SummaryCard label="Resultado estimado" value={ready ? formatCurrency(netProfit) : "—"} icon={<CircleDollarSign size={18} />} highlight />
      </div>

      {message && <div role="status" className="rounded-lg border border-[#eee2d4] bg-[#fcf7ef] px-4 py-3 text-sm text-[#75563e]">{message}</div>}
      {!ready && <p className="rounded-lg bg-white p-4 text-sm text-[#897d72]">Carregando vendas e financeiro…</p>}

      {mode === "vendas" ? (
        <>
          <form onSubmit={registerSale} className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#4a3c33]"><Plus size={18} /> Registrar venda</div>
            {products.length === 0 ? (
              <p className="text-sm leading-6 text-[#897d72]">Cadastre um produto, monte sua receita e registre uma produção antes de lançar vendas.</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="text-xs font-medium text-[#786c62] sm:col-span-3">
                    Produto
                    <select required value={saleDraft.productId} onChange={(event) => {
                      const product = productsById.get(event.target.value);
                      setSaleDraft((current) => ({ ...current, productId: event.target.value, unitPrice: product ? String(priceFor(product)) : "" }));
                    }} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]">
                      <option value="">Selecione um produto produzido</option>
                      {products.map((product) => {
                        const available = product.producedUnits - (soldByProduct.get(product.id) ?? 0);
                        return <option key={product.id} value={product.id} disabled={available <= 0}>{product.name} — {Math.max(available, 0)} disponível(is)</option>;
                      })}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-[#786c62]">
                    Quantidade (unidades)
                    <input required type="number" min="1" step="1" value={saleDraft.quantity} onChange={(event) => setSaleDraft({ ...saleDraft, quantity: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
                  </label>
                  <label className="text-xs font-medium text-[#786c62]">
                    Preço de venda por unidade (R$)
                    <input required type="number" min="0.01" step="0.01" value={saleDraft.unitPrice} onChange={(event) => setSaleDraft({ ...saleDraft, unitPrice: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
                  </label>
                  <div className="flex items-end text-xs leading-5 text-[#897d72]">
                    {saleDraft.productId && productsById.has(saleDraft.productId)
                      ? `Disponível para venda: ${Math.max((productsById.get(saleDraft.productId)?.producedUnits ?? 0) - (soldByProduct.get(saleDraft.productId) ?? 0), 0)} unidade(s).`
                      : "A venda só pode usar unidades já registradas em produção."}
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button type="submit" disabled={!ready} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#815a40] px-4 text-sm font-semibold text-white hover:bg-[#69462f] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} /> Salvar venda</button>
                </div>
              </>
            )}
          </form>

          <div className="overflow-hidden rounded-xl border border-[#eee7de] bg-[#fffdfa]">
            <div className="flex items-center gap-2 border-b border-[#eee7de] px-4 py-3.5"><ClipboardList size={17} className="text-[#8c684c]" /><h3 className="font-serif text-base font-medium text-[#4a3c33]">Vendas registradas</h3></div>
            {ready && sortedSales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead className="bg-[#faf6f0] text-xs font-semibold text-[#897d72]"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Quantidade</th><th className="px-4 py-3">Preço / unidade</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Margem bruta</th></tr></thead>
                  <tbody className="divide-y divide-[#f0e9e1]">
                    {sortedSales.map((sale) => {
                      const product = productsById.get(sale.productId);
                      const margin = sale.quantity * (sale.unitPrice - sale.unitCost);
                      return <tr key={sale.id}><td className="px-4 py-3.5 text-[#786c62]">{formatDate(sale.soldAt)}</td><td className="px-4 py-3.5 font-medium text-[#4a3c33]">{product?.name ?? "Produto"}</td><td className="px-4 py-3.5 text-[#786c62]">{sale.quantity}</td><td className="px-4 py-3.5 text-[#786c62]">{formatCurrency(sale.unitPrice)}</td><td className="px-4 py-3.5 font-medium text-[#4a3c33]">{formatCurrency(sale.quantity * sale.unitPrice)}</td><td className="px-4 py-3.5 text-[#5f7257]">{formatCurrency(margin)}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            ) : ready ? <p className="px-4 py-8 text-center text-sm text-[#897d72]">As vendas registradas aparecerão aqui.</p> : null}
          </div>
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[#eee7de] bg-[#fffdfa]">
            <div className="border-b border-[#eee7de] px-4 py-4">
              <div className="flex items-center gap-2"><Tag size={17} className="text-[#8c684c]" /><h3 className="font-serif text-base font-medium text-[#4a3c33]">Central de precificação</h3></div>
              <p className="mt-1 text-xs leading-5 text-[#897d72]">O custo considera os ingredientes cadastrados na receita. A sugestão inicial é 2,5 vezes o custo; ajuste o preço conforme sua estratégia.</p>
            </div>
            {ready && products.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-[#faf6f0] text-xs font-semibold text-[#897d72]"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Custo / unidade</th><th className="px-4 py-3">Preço de venda</th><th className="px-4 py-3">Lucro bruto / unidade</th><th className="px-4 py-3">Margem bruta</th></tr></thead>
                  <tbody className="divide-y divide-[#f0e9e1]">
                    {products.map((product) => {
                      const cost = productUnitCost(product);
                      const price = priceFor(product);
                      const profit = price - cost;
                      const margin = price > 0 ? (profit / price) * 100 : 0;
                      return <tr key={product.id}><td className="px-4 py-3.5 font-medium text-[#4a3c33]">{product.name}</td><td className="px-4 py-3.5 text-[#786c62]">{formatCurrency(cost)}</td><td className="px-4 py-3.5"><label className="sr-only" htmlFor={`price-${product.id}`}>Preço de venda de {product.name}</label><div className="flex max-w-40 items-center rounded-md border border-[#e5dcd2] bg-white px-2"><span className="text-xs text-[#897d72]">R$</span><input id={`price-${product.id}`} type="number" min="0" step="0.01" key={`${product.id}-${prices[product.id]}`} defaultValue={prices[product.id] ?? Number((cost * 2.5).toFixed(2))} onBlur={(event) => void updatePrice(product.id, event.target.value)} className="w-full border-0 bg-transparent px-2 py-2 text-sm text-[#41352f] outline-none" /></div></td><td className={profit >= 0 ? "px-4 py-3.5 font-medium text-[#5f7257]" : "px-4 py-3.5 font-medium text-[#a05d42]"}>{formatCurrency(profit)}</td><td className="px-4 py-3.5 text-[#786c62]">{price > 0 ? `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(margin)}%` : "—"}</td></tr>;
                    })}
                  </tbody>
                </table>
              </div>
            ) : ready ? <p className="px-4 py-8 text-center text-sm text-[#897d72]">Cadastre produtos com receitas para calcular custos e preços sugeridos.</p> : null}
          </div>

          <form onSubmit={registerExpense} className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#4a3c33]"><ReceiptText size={18} /> Registrar despesa</div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-medium text-[#786c62] sm:col-span-2">
                Descrição
                <input required maxLength={100} value={expenseDraft.description} onChange={(event) => setExpenseDraft({ ...expenseDraft, description: event.target.value })} placeholder="Ex.: compra de embalagens" className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
              </label>
              <label className="text-xs font-medium text-[#786c62]">
                Categoria
                <select value={expenseDraft.category} onChange={(event) => setExpenseDraft({ ...expenseDraft, category: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]">{expenseCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
              </label>
              <label className="text-xs font-medium text-[#786c62]">
                Valor (R$)
                <input required type="number" min="0.01" step="0.01" value={expenseDraft.amount} onChange={(event) => setExpenseDraft({ ...expenseDraft, amount: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
              </label>
              <label className="text-xs font-medium text-[#786c62]">
                Data
                <input required type="date" value={expenseDraft.spentAt} onChange={(event) => setExpenseDraft({ ...expenseDraft, spentAt: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
              </label>
            </div>
            <div className="mt-4 flex justify-end"><button type="submit" disabled={!ready} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#815a40] px-4 text-sm font-semibold text-white hover:bg-[#69462f] disabled:cursor-not-allowed disabled:opacity-50"><Plus size={16} /> Salvar despesa</button></div>
          </form>

          <div className="overflow-hidden rounded-xl border border-[#eee7de] bg-[#fffdfa]">
            <div className="flex items-center gap-2 border-b border-[#eee7de] px-4 py-3.5"><ClipboardList size={17} className="text-[#8c684c]" /><h3 className="font-serif text-base font-medium text-[#4a3c33]">Despesas registradas</h3></div>
            {ready && sortedExpenses.length > 0 ? (
              <ul className="divide-y divide-[#f0e9e1]">
                {sortedExpenses.map((expense) => <li key={expense.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"><span><span className="font-medium text-[#4a3c33]">{expense.description}</span><span className="ml-2 rounded-full bg-[#f5eee5] px-2 py-1 text-[10px] text-[#806852]">{expense.category}</span></span><span className="flex items-center gap-4"><span className="text-xs text-[#897d72]">{formatDate(expense.spentAt)}</span><strong className="text-[#a05d42]">{formatCurrency(expense.amount)}</strong></span></li>)}
              </ul>
            ) : ready ? <p className="px-4 py-8 text-center text-sm text-[#897d72]">As despesas registradas aparecerão aqui.</p> : null}
          </div>
        </>
      )}

      <p className="text-center text-[11px] text-[#a19488]">O resultado apresentado considera as vendas e despesas registradas na sua conta. O custo da venda fica salvo no momento do lançamento.</p>
    </section>
  );
}

function SummaryCard({ label, value, icon, highlight = false }: { label: string; value: string; icon: ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-[#897d72]"><span>{label}</span><span className={highlight ? "text-[#6f805f]" : "text-[#9a785d]"}>{icon}</span></div>
      <strong className={highlight ? "mt-2 block text-xl font-semibold text-[#5f7257]" : "mt-2 block text-xl font-semibold text-[#4a3c33]"}>{value}</strong>
    </div>
  );
}
