import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CloudUpload, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readBusiness, saveBusiness } from "./business.functions";
import { businessSchema, emptyBusinessData, type BusinessData } from "./business-schema";

type Store = { data: BusinessData; commit: (data: BusinessData) => Promise<boolean> };
const BusinessContext = createContext<Store | null>(null);
const legacyKeys = { materials: "materias-primas", movements: "movimentacoes-estoque", products: "produtos", productions: "producoes", sales: "vendas", expenses: "despesas", prices: "precos" } as const;

export function BusinessProvider({ children }: { children: ReactNode }) {
  const read = useServerFn(readBusiness);
  const save = useServerFn(saveBusiness);
  const [data, setData] = useState<BusinessData>(emptyBusinessData);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [legacy, setLegacy] = useState<BusinessData | null>(null);
  const revision = useRef(0);
  const locked = useRef(false);
  const mounted = useRef(true);

  async function load() {
    setError("");
    try {
      const result = await read();
      if (!mounted.current) return;
      revision.current = result.revision;
      setData(result.data);
      setReady(true);
    } catch {
      if (mounted.current) setError("Não foi possível carregar seus registros. Tente novamente.");
    }
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    try {
      const candidate = Object.fromEntries(Object.entries(legacyKeys).map(([field, key]) => [field, JSON.parse(localStorage.getItem(`ana-bolachas-${key}-v1`) ?? (field === "prices" ? "{}" : "[]"))]));
      const parsed = businessSchema.safeParse(candidate);
      if (parsed.success && Object.values(parsed.data).some((items) => Object.keys(items).length > 0)) setLegacy(parsed.data);
    } catch { /* Never automatically upload unscoped browser data. */ }
    return () => { mounted.current = false; };
  }, []);

  async function commit(next: BusinessData) {
    if (locked.current || !ready) return false;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await save({ data: { revision: revision.current, data: next } });
      if (!result.ok) {
        if (result.conflict) {
          const current = await read();
          revision.current = current.revision;
          setData(current.data);
          setError("Os registros foram alterados em outro dispositivo. Confira os saldos e tente novamente.");
        } else setError(result.invalidRecipe ? "A receita vinculada precisa existir e estar ativa. Confira a ficha técnica antes de salvar." : "Não foi possível salvar. Seus registros anteriores foram mantidos.");
        return false;
      }
      revision.current = result.revision;
      setData(next);
      return true;
    } catch {
      setError("Não foi possível confirmar a gravação. Recarregue os registros antes de tentar novamente.");
      setReady(false);
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  const isEmpty = Object.values(data).every((items) => Object.keys(items).length === 0);
  return <BusinessContext.Provider value={{ data, commit }}>
    {error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted p-4 text-sm text-foreground">{error}<Button variant="outline" onClick={() => void load()} disabled={busy}><RefreshCw /> Recarregar registros</Button></div>}
    {ready && legacy && isEmpty && <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4 text-sm text-muted-foreground"><span>Há registros antigos neste navegador. Deseja importá-los para esta conta?</span><Button variant="outline" disabled={busy} onClick={async () => { if (await commit(legacy)) setLegacy(null); }}><CloudUpload /> Importar registros</Button></div>}
    {!ready ? <p role="status" className="py-6 text-sm text-muted-foreground">Carregando seus registros…</p> : <fieldset disabled={busy} className="min-w-0 border-0 p-0">{busy && <p role="status" className="mb-3 text-sm text-muted-foreground">Salvando no Supabase…</p>}{children}</fieldset>}
  </BusinessContext.Provider>;
}

export function useBusinessStore() {
  const store = useContext(BusinessContext);
  if (!store) throw new Error("BusinessProvider is required");
  return store;
}
