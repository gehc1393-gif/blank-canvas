import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownToLine, ClipboardList, Cookie, Factory, Plus, Trash2 } from "lucide-react";

import { useBusinessStore } from "@/lib/business-store";

type Material = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  minimum: number;
  unitCost: number;
};

type Movement = {
  id: string;
  materialId: string;
  kind: "entrada" | "saida";
  quantity: number;
  note: string;
  createdAt: string;
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
type Production = {
  id: string;
  productId: string;
  batches: number;
  units: number;
  createdAt: string;
};
type ProductDraft = {
  name: string;
  batchYield: string;
  materialId: string;
  ingredientQuantity: string;
};

const emptyDraft: ProductDraft = {
  name: "",
  batchYield: "12",
  materialId: "",
  ingredientQuantity: "",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

export function ProductManager() {
  const { data, commit } = useBusinessStore();
  const { materials, products, productions } = data;
  const ready = true;
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [recipe, setRecipe] = useState<RecipeItem[]>([]);
  const [productionProductId, setProductionProductId] = useState<string | null>(null);
  const [batchCount, setBatchCount] = useState("1");
  const [message, setMessage] = useState("");

  const materialsById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials],
  );
  const recipeCost = recipe.reduce((total, item) => {
    const material = materialsById.get(item.materialId);
    return total + (material ? material.unitCost * item.quantity : 0);
  }, 0);

  function addIngredient() {
    const quantity = Number(draft.ingredientQuantity);
    if (!draft.materialId || !Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Escolha uma matéria-prima e informe uma quantidade maior que zero.");
      return;
    }
    setRecipe((current) => [...current, { materialId: draft.materialId, quantity }]);
    setDraft((current) => ({ ...current, materialId: "", ingredientQuantity: "" }));
    setMessage("");
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const batchYield = Number(draft.batchYield);
    if (!draft.name.trim() || !Number.isFinite(batchYield) || batchYield <= 0 || recipe.length === 0) {
      setMessage("Informe o nome, o rendimento da receita e pelo menos uma matéria-prima.");
      return;
    }
    if (products.some((product) => product.name.toLocaleLowerCase("pt-BR") === draft.name.trim().toLocaleLowerCase("pt-BR"))) {
      setMessage("Já existe um produto com esse nome.");
      return;
    }
    const product: Product = {
      id: makeId(),
      name: draft.name.trim(),
      batchYield,
      recipe,
      producedUnits: 0,
      createdAt: new Date().toISOString(),
    };
    if (!await commit({ ...data, products: [...products, product] })) return;
    setDraft(emptyDraft);
    setRecipe([]);
    setShowForm(false);
    setMessage(`${product.name} foi cadastrado com sua receita.`);
  }

  async function registerProduction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = products.find((item) => item.id === productionProductId);
    const batches = Number(batchCount);
    if (!product || !Number.isFinite(batches) || batches <= 0) {
      setMessage("Informe uma quantidade de fornadas maior que zero.");
      return;
    }

    try {
      const storedMaterials = materials;
      const storedMovements = data.movements;
      const availableById = new Map(storedMaterials.map((material) => [material.id, material]));
      const needs = new Map<string, number>();
      for (const item of product.recipe) {
        needs.set(item.materialId, (needs.get(item.materialId) ?? 0) + item.quantity * batches);
      }
      for (const [materialId, quantity] of needs) {
        const material = availableById.get(materialId);
        if (!material) {
          setMessage("Uma matéria-prima desta receita não está mais cadastrada no estoque.");
          return;
        }
        if (quantity > material.quantity) {
          setMessage(`Estoque insuficiente de ${material.name}: a receita precisa de ${formatQuantity(quantity, material.unit)} e há ${formatQuantity(material.quantity, material.unit)}.`);
          return;
        }
      }

      const now = new Date().toISOString();
      const updatedMaterials = storedMaterials.map((material) => ({
        ...material,
        quantity: material.quantity - (needs.get(material.id) ?? 0),
      }));
      const newMovements: Movement[] = [...needs].map(([materialId, quantity]) => ({
        id: makeId(),
        materialId,
        kind: "saida",
        quantity,
        note: `Produção: ${product.name}`,
        createdAt: now,
      }));
      const production: Production = {
        id: makeId(),
        productId: product.id,
        batches,
        units: batches * product.batchYield,
        createdAt: now,
      };
      const updatedProducts = products.map((item) => item.id === product.id
        ? { ...item, producedUnits: item.producedUnits + production.units }
        : item);
      const nextMovements = [...newMovements, ...storedMovements];
      if (!await commit({ ...data, materials: updatedMaterials, movements: nextMovements, products: updatedProducts, productions: [production, ...productions] })) return;
      setProductionProductId(null);
      setBatchCount("1");
      setMessage(`Produção registrada: ${production.units} unidades de ${product.name}. O estoque de ingredientes foi atualizado.`);
    } catch {
      setMessage("Não foi possível registrar a produção. Os dados do estoque foram mantidos.");
    }
  }

  const recentProductions = [...productions]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5);

  return (
    <section className="space-y-5" aria-labelledby="products-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">RECEITAS E PRODUÇÃO</span>
          <h2 id="products-title" className="mt-2 font-serif text-2xl font-medium text-[#4a3c33]">Produtos e receitas</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#897d72]">Monte as receitas com os ingredientes do estoque e registre as fornadas para dar baixa nas matérias-primas.</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#815a40] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#69462f]"
          onClick={() => { setShowForm((open) => !open); setProductionProductId(null); setMessage(""); }}
        >
          <Plus size={17} /> Cadastrar produto
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-4">
          <span className="text-xs text-[#897d72]">Produtos cadastrados</span>
          <strong className="mt-2 block text-2xl font-semibold text-[#4a3c33]">{ready ? products.length : "—"}</strong>
        </div>
        <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-4">
          <span className="text-xs text-[#897d72]">Unidades produzidas</span>
          <strong className="mt-2 block text-2xl font-semibold text-[#4a3c33]">{ready ? products.reduce((total, product) => total + product.producedUnits, 0) : "—"}</strong>
        </div>
        <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-4">
          <span className="text-xs text-[#897d72]">Matérias-primas disponíveis</span>
          <strong className="mt-2 block text-2xl font-semibold text-[#4a3c33]">{ready ? materials.length : "—"}</strong>
        </div>
      </div>

      {message && <div role="status" className="rounded-lg border border-[#eee2d4] bg-[#fcf7ef] px-4 py-3 text-sm text-[#75563e]">{message}</div>}
      {!ready && <p className="rounded-lg bg-white p-4 text-sm text-[#897d72]">Carregando produtos e estoque…</p>}

      {showForm && (
        <form onSubmit={createProduct} className="space-y-5 rounded-xl border border-[#eee7de] bg-[#fffdfa] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#4a3c33]"><Cookie size={18} /> Novo produto e receita</div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-[#786c62]">
              Nome do produto
              <input autoFocus required maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Bolacha de nata" className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
            </label>
            <label className="text-xs font-medium text-[#786c62]">
              Rendimento por receita (unidades)
              <input required type="number" min="1" step="1" value={draft.batchYield} onChange={(event) => setDraft({ ...draft, batchYield: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
            </label>
          </div>

          <div className="rounded-lg border border-[#f0e9e1] bg-[#fcfaf7] p-4">
            <h3 className="text-sm font-semibold text-[#4a3c33]">Ingredientes por receita</h3>
            {materials.length === 0 ? (
              <p className="mt-2 text-sm leading-6 text-[#897d72]">Cadastre matérias-primas no estoque antes de montar uma receita.</p>
            ) : (
              <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_180px_auto]">
                <label className="text-xs font-medium text-[#786c62]">
                  Matéria-prima
                  <select value={draft.materialId} onChange={(event) => setDraft({ ...draft, materialId: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]">
                    <option value="">Selecione um ingrediente</option>
                    {materials.map((material) => <option key={material.id} value={material.id}>{material.name} ({material.unit})</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-[#786c62]">
                  Quantidade usada
                  <input type="number" min="0.001" step="0.001" value={draft.ingredientQuantity} onChange={(event) => setDraft({ ...draft, ingredientQuantity: event.target.value })} placeholder="Ex.: 0,5" className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
                </label>
                <button type="button" onClick={addIngredient} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[#e5dcd2] px-3 text-sm font-medium text-[#80583e] hover:bg-[#f8f3ed]"><Plus size={16} /> Adicionar</button>
              </div>
            )}

            {recipe.length > 0 && (
              <ul className="mt-4 divide-y divide-[#eee7de] rounded-md border border-[#eee7de] bg-white">
                {recipe.map((item, index) => {
                  const material = materialsById.get(item.materialId);
                  return (
                    <li key={`${item.materialId}-${index}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                      <span className="text-[#4a3c33]">{material?.name ?? "Matéria-prima removida"}<span className="ml-2 text-xs text-[#897d72]">{material ? formatQuantity(item.quantity, material.unit) : ""}</span></span>
                      <button type="button" onClick={() => setRecipe((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${material?.name ?? "ingrediente"} da receita`} className="grid h-8 w-8 place-items-center rounded-md text-[#9a6844] hover:bg-[#f8eee6]"><Trash2 size={15} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
            {recipe.length > 0 && (
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-[#786c62]">
                <span>Custo estimado da receita: <strong className="text-[#4a3c33]">{formatCurrency(recipeCost)}</strong></span>
                <span>Custo estimado por unidade: <strong className="text-[#4a3c33]">{formatCurrency(recipeCost / Math.max(Number(draft.batchYield) || 1, 1))}</strong></span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setRecipe([]); }} className="rounded-lg border border-[#e5dcd2] px-4 py-2 text-sm text-[#786c62] hover:bg-[#faf6f0]">Cancelar</button>
            <button type="submit" disabled={materials.length === 0} className="rounded-lg bg-[#815a40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#69462f] disabled:cursor-not-allowed disabled:opacity-50">Salvar produto e receita</button>
          </div>
        </form>
      )}

      {productionProductId && (() => {
        const product = products.find((item) => item.id === productionProductId);
        if (!product) return null;
        return (
          <form onSubmit={registerProduction} className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#4a3c33]"><Factory size={18} /> Registrar produção — {product.name}</div>
            <p className="mb-4 text-xs leading-5 text-[#897d72]">Cada receita rende {product.batchYield} unidades. O estoque será conferido antes de registrar as saídas.</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-xs font-medium text-[#786c62]">
                Número de receitas / fornadas
                <input autoFocus required type="number" min="1" step="1" value={batchCount} onChange={(event) => setBatchCount(event.target.value)} className="mt-1.5 block w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69] sm:w-56" />
              </label>
              <span className="pb-2 text-xs text-[#897d72]">Total previsto: {product.batchYield * (Number(batchCount) || 0)} unidades</span>
              <div className="ml-auto flex gap-2">
                <button type="button" onClick={() => setProductionProductId(null)} className="rounded-lg border border-[#e5dcd2] px-4 py-2 text-sm text-[#786c62] hover:bg-[#faf6f0]">Cancelar</button>
                <button type="submit" className="rounded-lg bg-[#815a40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#69462f]">Confirmar produção</button>
              </div>
            </div>
          </form>
        );
      })()}

      <div className="grid gap-4 md:grid-cols-2">
        {ready && products.map((product) => {
          const totalCost = product.recipe.reduce((total, item) => {
            const material = materialsById.get(item.materialId);
            return total + (material ? material.unitCost * item.quantity : 0);
          }, 0);
          return (
            <article key={product.id} className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f6e9dd] text-[#9a6844]"><Cookie size={20} /></span>
                  <div><h3 className="font-serif text-lg font-medium text-[#4a3c33]">{product.name}</h3><p className="mt-1 text-xs text-[#897d72]">Rende {product.batchYield} unidades por receita</p></div>
                </div>
                <button type="button" onClick={() => { setProductionProductId(product.id); setShowForm(false); setBatchCount("1"); setMessage(""); }} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#815a40] px-3 text-xs font-semibold text-white hover:bg-[#69462f]"><Factory size={15} /> Produzir</button>
              </div>
              <div className="mt-4 space-y-2 border-t border-[#f0e9e1] pt-4">
                <div className="flex justify-between gap-3 text-xs"><span className="text-[#897d72]">Custo estimado da receita</span><strong className="text-[#4a3c33]">{formatCurrency(totalCost)}</strong></div>
                <div className="flex justify-between gap-3 text-xs"><span className="text-[#897d72]">Custo estimado por unidade</span><strong className="text-[#4a3c33]">{formatCurrency(totalCost / product.batchYield)}</strong></div>
                <div className="flex justify-between gap-3 text-xs"><span className="text-[#897d72]">Total produzido</span><strong className="text-[#4a3c33]">{product.producedUnits} unidades</strong></div>
              </div>
              <ul className="mt-4 space-y-1.5">
                {product.recipe.map((item, index) => {
                  const material = materialsById.get(item.materialId);
                  return <li key={`${item.materialId}-${index}`} className="flex justify-between gap-3 text-xs"><span className="text-[#786c62]">{material?.name ?? "Matéria-prima não disponível"}</span><span className="text-[#897d72]">{material ? formatQuantity(item.quantity, material.unit) : "—"}</span></li>;
                })}
              </ul>
            </article>
          );
        })}
      </div>

      {ready && products.length === 0 && (
        <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa] px-5 py-12 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f5eee5] text-[#8c684c]"><Cookie size={23} /></span>
          <h3 className="mt-4 font-serif text-lg font-medium text-[#4a3c33]">Nenhum produto cadastrado</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#897d72]">Cadastre primeiro suas matérias-primas no estoque. Depois, monte receitas e registre cada fornada.</p>
          {materials.length > 0 && <button type="button" onClick={() => setShowForm(true)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#80583e] hover:text-[#5f3d28]"><Plus size={16} /> Cadastrar o primeiro produto</button>}
        </div>
      )}

      <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa]">
        <div className="flex items-center gap-2 border-b border-[#eee7de] px-4 py-3.5"><ClipboardList size={17} className="text-[#8c684c]" /><h3 className="font-serif text-base font-medium text-[#4a3c33]">Produções recentes</h3></div>
        {recentProductions.length > 0 ? (
          <ul className="divide-y divide-[#f0e9e1]">
            {recentProductions.map((production) => {
              const product = products.find((item) => item.id === production.productId);
              return <li key={production.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="flex items-center gap-2"><ArrowDownToLine size={16} className="text-[#6f805f]" /><span className="font-medium text-[#4a3c33]">{product?.name ?? "Produto"}</span><span className="text-[#897d72]">{production.batches} {production.batches === 1 ? "receita" : "receitas"} · {production.units} unidades</span></span><span className="text-xs text-[#897d72]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(production.createdAt))}</span></li>;
            })}
          </ul>
        ) : <p className="px-4 py-5 text-sm text-[#897d72]">As produções registradas aparecerão aqui.</p>}
      </div>

      <p className="text-center text-[11px] text-[#a19488]">A produção e as baixas de estoque ficam salvas na sua conta.</p>
    </section>
  );
}
