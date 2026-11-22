import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { compatibleUnits } from "@/lib/recipe-schema";
import { listSuppliers } from "@/lib/supplier.functions";
import { readMaterialSuppliers, writeMaterialSupplier, type SupplierChange } from "@/lib/material-supplier.functions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 6 });
const dateLabel = (iso: string) => iso.split("-").reverse().join("/");
const control = "block w-full rounded-md border bg-white p-2";
export function MaterialSuppliers({ material, userId, close }: {
  material: {id: string; name: string; unit: string}; userId: string; close: () => void;
}) {
  const client = useQueryClient();
  const read = useServerFn(readMaterialSuppliers), write = useServerFn(writeMaterialSupplier), suppliers = useServerFn(listSuppliers);
  const key = ["material-suppliers", userId, material.id];
  const links = useQuery({ queryKey: key, queryFn: () => read({ data: material.id }) });
  const catalog = useQuery({ queryKey: ["suppliers", userId], queryFn: () => suppliers() });
  const mutation = useMutation({ mutationFn: (data: SupplierChange) => write({ data }),
    onSuccess: () => client.invalidateQueries({ queryKey: key }) });
  const [supplier, setSupplier] = useState("");
  const units = compatibleUnits(material.unit);
  const basis = units.includes("kg") ? "kg" : units.includes("L") ? "L" : material.unit;
  const available = catalog.data?.filter(s => s.active && !links.data?.some(l => l.supplier_id === s.id));
  const current = links.data?.flatMap(l => l.active && l.history[0] && units.includes(l.history[0].unit) ? [l.history[0].equivalent] : []) ?? [];
  const min = Math.min(...current);
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
      <DialogTitle>Fornecedores do Ingrediente</DialogTitle><h3>{material.name}</h3>
      {(links.isError || catalog.isError) && <p role="alert">Falha ao carregar os fornecedores. <button onClick={() => { void links.refetch(); void catalog.refetch(); }}>Tentar novamente</button></p>}
      {mutation.error && <p role="alert">{mutation.error.message}</p>}
      {links.isPending && <p>Carregando vínculos…</p>}
      <fieldset disabled={mutation.isPending || !links.data} className="space-y-4">
        <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); mutation.mutate({p_material: material.id,p_supplier: supplier,p_action:"link"}, { onSuccess: () => setSupplier("") }); }}>
          <label>Fornecedor<select className={control} required value={supplier} onChange={e => setSupplier(e.target.value)}><option value="">Selecione</option>{available?.map(s => <option key={s.id} value={s.id}>{s.name} · #{s.code}</option>)}</select></label>
          <Button disabled={!supplier}>Vincular fornecedor</Button>
        </form>
        {links.data?.length === 0 && <p>Nenhum fornecedor vinculado.</p>}
        {!!links.data?.length && <p className="text-sm">Comparação pela última cotação de cada fornecedor ativo. Confirme a vigência do preço com o fornecedor.</p>}
        {links.data?.map(l => {
          const latest = l.history[0];
          const args = { p_material: material.id, p_supplier: l.supplier_id };
          return <section className="space-y-3 rounded-lg border p-4" key={l.supplier_id}>
            <h4 className="font-semibold">{l.name}{!l.active && " · Inativo"}{l.is_primary && " · Principal"}</h4>
            {latest ? <p>{latest.quantity} {latest.unit} por {money.format(latest.price)} · {money.format(latest.equivalent)}/{units.includes(latest.unit) ? basis : latest.unit} · Cotado em {dateLabel(latest.date)}
              {l.active && units.includes(latest.unit) && latest.equivalent === min && <strong className="block text-green-800">Menor preço equivalente cotado</strong>}</p> : <p>Sem cotação registrada.</p>}
            {!l.is_primary && l.active && <Button variant="outline" onClick={() => mutation.mutate({...args,p_action:"primary"})}>Definir como principal</Button>}
            <form onSubmit={e => { e.preventDefault(); mutation.mutate({...args,p_action:"notes",p_notes:String(new FormData(e.currentTarget).get("notes"))}); }}>
              <label>Observações<textarea className={control} name="notes" maxLength={3000} defaultValue={l.notes}/></label><Button variant="outline">Salvar observações</Button>
            </form>
            <details><summary>Registrar cotação</summary><form className="grid gap-3 sm:grid-cols-2" onSubmit={e => {
              e.preventDefault(); const form=e.currentTarget, values=new FormData(form);
              mutation.mutate({...args,p_action:"quote",p_price:Number(values.get("price")),p_quantity:Number(values.get("quantity")),p_unit:String(values.get("unit")),p_date:String(values.get("date"))}, {onSuccess: () => form.reset()});
            }}>
              <label>Preço da embalagem (R$)<input required className={control} name="price" type="number" min="0.01" step="0.01"/></label>
              <label>Quantidade da embalagem<input required className={control} name="quantity" type="number" min="0.000001" step="0.000001"/></label>
              <label>Unidade<select className={control} name="unit" defaultValue={material.unit}>{units.map(u => <option key={u}>{u}</option>)}</select></label>
              <label>Data da cotação<input required className={control} name="date" type="date"/></label><Button>Salvar cotação</Button>
            </form></details>
            <details><summary>Histórico de preços ({l.history.length})</summary><ul className="space-y-2">{l.history.map((q,i) => <li key={i} className="break-words border-t py-2 text-sm">
              {dateLabel(q.date)} · {q.quantity} {q.unit} por {money.format(q.price)} · Registrado em {new Date(q.recorded).toLocaleString("pt-BR")} · Responsável: {q.author === userId ? "Você" : q.author}
            </li>)}</ul></details>
          </section>;
        })}
      </fieldset>
    </DialogContent></Dialog>;
}
