import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { blankSupplier, supplierFields, supplierSchema, type Supplier } from "@/lib/supplier-schema";
import { listSuppliers, saveSupplier } from "@/lib/supplier.functions";

export function SupplierManager({ userId }: { userId: string }) {
  const list = useServerFn(listSuppliers), save = useServerFn(saveSupplier);
  const client = useQueryClient(), key = ["suppliers", userId];
  const query = useQuery({ queryKey: key, queryFn: () => list() });
  const [search, setSearch] = useState(""), [filter, setFilter] = useState("todos");
  const [panel, setPanel] = useState<"new" | "view" | "edit" | null>(null);
  const [selected, setSelected] = useState<Supplier>(), [draft, setDraft] = useState(blankSupplier);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function open(mode: typeof panel, row?: Supplier) {
    setNotice(""); setSelected(row); setDraft(row ?? blankSupplier); setError(""); setPanel(mode);
  }
  async function commit(data: NonNullable<Parameters<typeof save>[0]>["data"]) {
    setNotice(""); setError(""); setBusy(true);
    try {
      await save({ data });
      await client.invalidateQueries({ queryKey: key });
      setPanel(null); setNotice("Cadastro atualizado.");
    } catch (err) { setError(err instanceof Error ? err.message : "Falha ao salvar."); }
    finally { setBusy(false); }
  }
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const rows = query.data?.filter(row => (filter === "todos" || row.active === (filter === "ativos")) &&
    [row.name, row.trade_name].some(value => value.toLocaleLowerCase("pt-BR").includes(term)));
  const view = panel === "view";
  return <section className="space-y-4">
    <div className="flex flex-wrap gap-3">
      <Input aria-label="Pesquisar por nome ou empresa" placeholder="Pesquisar por nome ou empresa" className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} />
      <select aria-label="Situação" value={filter} onChange={e => setFilter(e.target.value)}><option value="todos">Todos</option><option value="ativos">Ativos</option><option value="inativos">Inativos</option></select>
      <Button onClick={() => open("new")}>Novo Fornecedor</Button>
    </div>
    {query.isLoading && <p>Carregando fornecedores…</p>}
    {query.isError && <p role="alert">Falha ao carregar fornecedores. <button onClick={() => query.refetch()}>Tentar novamente</button></p>}
    {notice && <p role="status">{notice}</p>}
    {!panel && error && <p role="alert">{error}</p>}
    {rows?.length === 0 && <p>Nenhum fornecedor encontrado.</p>}
    {rows?.map(row => <article key={row.id} className="rounded-lg border bg-white p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 break-words"><strong>#{row.code} · {row.name}</strong><p>{row.trade_name} · {row.active ? "Ativo" : "Inativo"}</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => open("view", row)}>Visualizar</Button><Button variant="outline" onClick={() => open("edit", row)}>Editar</Button>
      <Button variant="outline" disabled={busy} onClick={() => commit({ action: "status", id: row.id, updated_at: row.updated_at, active: !row.active })}>{row.active ? "Inativar" : "Reativar"}</Button></div>
    </article>)}
    <Dialog open={!!panel} onOpenChange={next => { if (!next && !busy) setPanel(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{view ? "Ficha do fornecedor" : selected ? "Editar fornecedor" : "Novo Fornecedor"}</DialogTitle></DialogHeader>
      {selected && <p className="text-sm">Código {selected.code} · Cadastro em {new Date(selected.created_at).toLocaleString("pt-BR")} · Última alteração em {new Date(selected.updated_at).toLocaleString("pt-BR")}</p>}
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={e => {
        e.preventDefault(); if (view || busy) return;
        const result = supplierSchema.safeParse(draft);
        if (!result.success) { setError(result.error.issues[0]?.message ?? "Cadastro inválido."); return; }
        void commit(selected ? { action: "edit", id: selected.id, updated_at: selected.updated_at, values: result.data } : { action: "create", values: result.data });
      }}>
        <label>Tipo<select className="block w-full rounded border p-2" disabled={view} value={draft.person_type} onChange={e => setDraft({ ...draft, person_type: e.target.value as "PF" | "PJ" })}><option value="PF">Pessoa física</option><option value="PJ">Pessoa jurídica</option></select></label>
        <label>Situação<select className="block w-full rounded border p-2" disabled={view} value={String(draft.active)} onChange={e => setDraft({ ...draft, active: e.target.value === "true" })}><option value="true">Ativo</option><option value="false">Inativo</option></select></label>
        {(Object.keys(supplierFields) as (keyof typeof supplierFields)[]).map(field => <label key={field}>{supplierFields[field]}
          {field === "notes" ? <textarea className="block w-full rounded border p-2" readOnly={view} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} /> :
          <Input readOnly={view} required={field === "name"} type={field === "email" ? "email" : "text"} value={draft[field]} onChange={e => setDraft({ ...draft, [field]: e.target.value })} />}</label>)}
        {error && <p role="alert">{error}</p>}
        {!view && <Button disabled={busy}>Salvar</Button>}
      </form></DialogContent>
    </Dialog>
  </section>;
}
