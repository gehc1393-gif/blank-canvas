import { useMemo, useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, Package, Plus, Search } from "lucide-react";

import { MaterialSuppliers } from "@/components/material-suppliers";
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

type MaterialDraft = {
  name: string;
  unit: string;
  quantity: string;
  minimum: string;
  unitCost: string;
};

type MovementDraft = {
  kind: "entrada" | "saida";
  quantity: string;
  unitCost: string;
  note: string;
};

const units = ["kg", "g", "L", "ml", "unidade", "pacote"];
const emptyMaterialDraft: MaterialDraft = {
  name: "",
  unit: "kg",
  quantity: "0",
  minimum: "0",
  unitCost: "0",
};
const emptyMovementDraft: MovementDraft = {
  kind: "entrada",
  quantity: "",
  unitCost: "",
  note: "",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatQuantity(value: number, unit: string) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value)} ${unit}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function InventoryManager({ userId = "" }: { userId?: string } = {}) {
  const [supplierMaterial, setSupplierMaterial] = useState<Material | null>(null);
  const { data, commit } = useBusinessStore();
  const { materials, movements } = data;
  const ready = true;
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialDraft, setMaterialDraft] = useState<MaterialDraft>(emptyMaterialDraft);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [movementDraft, setMovementDraft] = useState<MovementDraft>(emptyMovementDraft);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  const filteredMaterials = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
    return materials.filter((material) =>
      material.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
    );
  }, [materials, search]);

  const lowStockCount = materials.filter((material) => material.quantity <= material.minimum).length;
  const inventoryValue = materials.reduce(
    (total, material) => total + material.quantity * material.unitCost,
    0,
  );
  const recentMovements = [...movements].sort(
    (first, second) => second.createdAt.localeCompare(first.createdAt),
  ).slice(0, 6);

  async function createMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(materialDraft.quantity);
    const minimum = Number(materialDraft.minimum);
    const unitCost = Number(materialDraft.unitCost);
    if (!materialDraft.name.trim() || ![quantity, minimum, unitCost].every(Number.isFinite)) {
      setMessage("Confira o nome e os valores informados.");
      return;
    }
    if (quantity < 0 || minimum < 0 || unitCost < 0) {
      setMessage("Quantidade, estoque mínimo e custo não podem ser negativos.");
      return;
    }

    const material: Material = {
      id: makeId(),
      name: materialDraft.name.trim(),
      unit: materialDraft.unit,
      quantity,
      minimum,
      unitCost,
    };
    const initialMovement: Movement = { id: makeId(), materialId: material.id, kind: "entrada", quantity, note: "Saldo inicial do cadastro", createdAt: new Date().toISOString() };
    if (!await commit({ ...data, materials: [...materials, material], movements: quantity > 0 ? [initialMovement, ...movements] : movements })) return;
    setMaterialDraft(emptyMaterialDraft);
    setShowMaterialForm(false);
    setMessage(`${material.name} foi adicionada ao estoque.`);
  }

  async function saveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const material = materials.find((item) => item.id === adjustingId);
    const quantity = Number(movementDraft.quantity);
    const normalizedCostString = movementDraft.unitCost.replace(",", ".");
    const updatedCost = normalizedCostString.trim() === "" ? undefined : Number(normalizedCostString);
    if (!material || !Number.isFinite(quantity) || quantity <= 0) {
      setMessage("Informe uma quantidade maior que zero.");
      return;
    }
    if (updatedCost !== undefined && (!Number.isFinite(updatedCost) || updatedCost < 0)) {
      setMessage("O custo unitário deve ser um valor válido, igual ou maior que zero.");
      return;
    }
    if (movementDraft.kind === "saida" && quantity > material.quantity) {
      setMessage(`Saldo insuficiente: há ${formatQuantity(material.quantity, material.unit)} de ${material.name}.`);
      return;
    }

    const nextMaterials = materials.map((item) => item.id !== material.id ? item : {
      ...item,
      quantity: item.quantity + (movementDraft.kind === "entrada" ? quantity : -quantity),
      ...(movementDraft.kind === "entrada" && updatedCost !== undefined ? { unitCost: updatedCost } : {}),
    });
    const movement: Movement = { id: makeId(), materialId: material.id, kind: movementDraft.kind, quantity, note: movementDraft.note.trim() || (movementDraft.kind === "entrada" ? "Entrada de estoque" : "Saída de estoque"), createdAt: new Date().toISOString() };
    if (!await commit({ ...data, materials: nextMaterials, movements: [movement, ...movements] })) return;
    setMessage(`${movementDraft.kind === "entrada" ? "Entrada" : "Saída"} registrada para ${material.name}.`);
    setAdjustingId(null);
    setMovementDraft(emptyMovementDraft);
  }

  function openAdjustment(material: Material, kind: MovementDraft["kind"]) {
    setShowMaterialForm(false);
    setAdjustingId(material.id);
    setMovementDraft({ ...emptyMovementDraft, kind });
    setMessage("");
  }

  return (
    <section className="space-y-5" aria-labelledby="inventory-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">INGREDIENTES E INSUMOS</span>
          <h2 id="inventory-title" className="mt-2 font-serif text-2xl font-medium text-[#4a3c33]">Estoque de matérias-primas</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#897d72]">Cadastre ingredientes, acompanhe os saldos e registre cada entrada ou saída.</p>
        </div>
        <button
          type="button"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#815a40] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#69462f]"
          onClick={() => { setShowMaterialForm((open) => !open); setAdjustingId(null); setMessage(""); }}
        >
          <Plus size={17} /> Cadastrar matéria-prima
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-4">
          <span className="text-xs text-[#897d72]">Itens cadastrados</span>
          <strong className="mt-2 block text-2xl font-semibold text-[#4a3c33]">{ready ? materials.length : "—"}</strong>
        </div>
        <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-4">
          <span className="text-xs text-[#897d72]">No mínimo ou abaixo</span>
          <strong className="mt-2 block text-2xl font-semibold text-[#9a6844]">{ready ? lowStockCount : "—"}</strong>
        </div>
        <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-4">
          <span className="text-xs text-[#897d72]">Valor estimado em estoque</span>
          <strong className="mt-2 block text-xl font-semibold text-[#4a3c33]">{ready ? formatCurrency(inventoryValue) : "—"}</strong>
        </div>
      </div>

      {!ready && <p className="rounded-lg bg-white p-4 text-sm text-[#897d72]">Carregando seu estoque…</p>}

      {message && (
        <div role="status" className="rounded-lg border border-[#eee2d4] bg-[#fcf7ef] px-4 py-3 text-sm text-[#75563e]">
          {message}
        </div>
      )}

      {supplierMaterial && <MaterialSuppliers userId={userId} material={supplierMaterial} close={() => setSupplierMaterial(null)} />}
      {showMaterialForm && (
        <form onSubmit={createMaterial} className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#4a3c33]"><Package size={18} /> Nova matéria-prima</div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <label className="text-xs font-medium text-[#786c62] sm:col-span-2 lg:col-span-2">
              Nome do ingrediente
              <input autoFocus required maxLength={80} value={materialDraft.name} onChange={(event) => setMaterialDraft({ ...materialDraft, name: event.target.value })} placeholder="Ex.: farinha de trigo" className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
            </label>
            <label className="text-xs font-medium text-[#786c62]">
              Unidade
              <select value={materialDraft.unit} onChange={(event) => setMaterialDraft({ ...materialDraft, unit: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]">
                {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-[#786c62]">
              Quantidade inicial
              <input required type="number" min="0" step="0.001" value={materialDraft.quantity} onChange={(event) => setMaterialDraft({ ...materialDraft, quantity: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
            </label>
            <label className="text-xs font-medium text-[#786c62]">
              Estoque mínimo
              <input required type="number" min="0" step="0.001" value={materialDraft.minimum} onChange={(event) => setMaterialDraft({ ...materialDraft, minimum: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
            </label>
            <label className="text-xs font-medium text-[#786c62] sm:col-span-2 lg:col-span-2">
              Custo por unidade (R$)
              <input required type="number" min="0" step="0.01" value={materialDraft.unitCost} onChange={(event) => setMaterialDraft({ ...materialDraft, unitCost: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setShowMaterialForm(false)} className="rounded-lg border border-[#e5dcd2] px-4 py-2 text-sm text-[#786c62] hover:bg-[#faf6f0]">Cancelar</button>
            <button type="submit" className="rounded-lg bg-[#815a40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#69462f]">Salvar ingrediente</button>
          </div>
        </form>
      )}

      {adjustingId && (() => {
        const material = materials.find((item) => item.id === adjustingId);
        if (!material) return null;
        return (
          <form onSubmit={saveMovement} className="rounded-xl border border-[#eee7de] bg-[#fffdfa] p-5">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#4a3c33]">
              {movementDraft.kind === "entrada" ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}
              {movementDraft.kind === "entrada" ? "Registrar entrada" : "Registrar saída"} — {material.name}
            </div>
            <p className="mb-4 text-xs text-[#897d72]">Saldo atual: {formatQuantity(material.quantity, material.unit)}</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs font-medium text-[#786c62]">
                Quantidade ({material.unit})
                <input autoFocus required type="number" min="0.001" step="0.001" value={movementDraft.quantity} onChange={(event) => setMovementDraft({ ...movementDraft, quantity: event.target.value })} className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
              </label>
              {movementDraft.kind === "entrada" && (
                <label className="text-xs font-medium text-[#786c62]">
                  Novo custo por unidade (R$), opcional
                  <input type="text" inputMode="decimal" value={movementDraft.unitCost} onChange={(event) => setMovementDraft({ ...movementDraft, unitCost: event.target.value })} placeholder="Ex.: 12.50" className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
                </label>
              )}
              <label className="text-xs font-medium text-[#786c62]">
                Observação, opcional
                <input maxLength={120} value={movementDraft.note} onChange={(event) => setMovementDraft({ ...movementDraft, note: event.target.value })} placeholder="Ex.: compra no fornecedor" className="mt-1.5 w-full rounded-md border border-[#e5dcd2] bg-white px-3 py-2.5 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setAdjustingId(null)} className="rounded-lg border border-[#e5dcd2] px-4 py-2 text-sm text-[#786c62] hover:bg-[#faf6f0]">Cancelar</button>
              <button type="submit" className="rounded-lg bg-[#815a40] px-4 py-2 text-sm font-semibold text-white hover:bg-[#69462f]">Salvar movimentação</button>
            </div>
          </form>
        );
      })()}

      <div className="overflow-hidden rounded-xl border border-[#eee7de] bg-[#fffdfa]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee7de] p-4">
          <div>
            <h3 className="font-serif text-lg font-medium text-[#4a3c33]">Matérias-primas cadastradas</h3>
            <p className="mt-1 text-xs text-[#897d72]">Os itens no estoque mínimo ou abaixo recebem um alerta.</p>
          </div>
          <label className="relative block w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a09285]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Buscar matéria-prima" placeholder="Buscar ingrediente" className="w-full rounded-md border border-[#e5dcd2] bg-white py-2 pl-9 pr-3 text-sm text-[#41352f] outline-none focus:border-[#b58b69]" />
          </label>
        </div>
        {ready && filteredMaterials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[#faf6f0] text-xs font-semibold text-[#897d72]">
                <tr><th className="px-4 py-3">Ingrediente</th><th className="px-4 py-3">Disponível</th><th className="px-4 py-3">Mínimo</th><th className="px-4 py-3">Custo / unidade</th><th className="px-4 py-3">Valor em estoque</th><th className="px-4 py-3">Ações</th></tr>
              </thead>
              <tbody className="divide-y divide-[#f0e9e1]">
                {filteredMaterials.map((material) => {
                  const low = material.quantity <= material.minimum;
                  return (
                    <tr key={material.id}>
                      <td className="px-4 py-3.5 font-medium text-[#4a3c33]">{material.name}</td>
                      <td className="px-4 py-3.5"><span className={low ? "font-semibold text-[#a05d42]" : "text-[#5f7257]"}>{formatQuantity(material.quantity, material.unit)}</span>{low && <span className="ml-2 rounded-full bg-[#f7ece5] px-2 py-1 text-[10px] font-medium text-[#9a6844]">Estoque baixo</span>}</td>
                      <td className="px-4 py-3.5 text-[#786c62]">{formatQuantity(material.minimum, material.unit)}</td>
                      <td className="px-4 py-3.5 text-[#786c62]">{formatCurrency(material.unitCost)}</td>
                      <td className="px-4 py-3.5 text-[#786c62]">{formatCurrency(material.quantity * material.unitCost)}</td>
                      <td className="px-4 py-3.5"><div className="flex gap-2"><button type="button" className="rounded border px-2" onClick={() => setSupplierMaterial(material)}>Fornecedores</button><button type="button" onClick={() => openAdjustment(material, "entrada")} aria-label={`Registrar entrada de ${material.name}`} title="Registrar entrada" className="grid h-8 w-8 place-items-center rounded-md border border-[#e5dcd2] text-[#6f805f] hover:bg-[#edf2e9]"><ArrowDownToLine size={15} /></button><button type="button" onClick={() => openAdjustment(material, "saida")} aria-label={`Registrar saída de ${material.name}`} title="Registrar saída" className="grid h-8 w-8 place-items-center rounded-md border border-[#e5dcd2] text-[#9a6844] hover:bg-[#f8eee6]"><ArrowUpFromLine size={15} /></button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : ready ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#f5eee5] text-[#8c684c]"><Package size={23} /></span>
            <h4 className="mt-4 font-serif text-lg font-medium text-[#4a3c33]">{search ? "Nenhum ingrediente encontrado" : "Seu estoque começa aqui"}</h4>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#897d72]">{search ? "Tente buscar por outro nome." : "Cadastre as matérias-primas usadas nas suas receitas para acompanhar quantidades e custos."}</p>
            {!search && <button type="button" onClick={() => setShowMaterialForm(true)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#80583e] hover:text-[#5f3d28]"><Plus size={16} /> Cadastrar a primeira matéria-prima</button>}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#eee7de] bg-[#fffdfa]">
        <div className="flex items-center gap-2 border-b border-[#eee7de] px-4 py-3.5"><ClipboardList size={17} className="text-[#8c684c]" /><h3 className="font-serif text-base font-medium text-[#4a3c33]">Movimentações recentes</h3></div>
        {recentMovements.length ? (
          <ul className="divide-y divide-[#f0e9e1]">
            {recentMovements.map((movement) => {
              const material = materials.find((item) => item.id === movement.materialId);
              return <li key={movement.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span className="flex items-center gap-2"><span className={movement.kind === "entrada" ? "text-[#6f805f]" : "text-[#a05d42]"}>{movement.kind === "entrada" ? <ArrowDownToLine size={16} /> : <ArrowUpFromLine size={16} />}</span><span className="font-medium text-[#4a3c33]">{material?.name ?? "Matéria-prima"}</span><span className="text-[#897d72]">{movement.note}</span></span><span className="text-xs text-[#897d72]">{movement.kind === "entrada" ? "+" : "−"}{formatQuantity(movement.quantity, material?.unit ?? "unidade")} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(movement.createdAt))}</span></li>;
            })}
          </ul>
        ) : (
          <p className="px-4 py-5 text-sm text-[#897d72]">As entradas e saídas registradas aparecerão aqui.</p>
        )}
      </div>

      <p className="text-center text-[11px] text-[#a19488]">Os registros de estoque ficam salvos na sua conta.</p>
    </section>
  );
}
