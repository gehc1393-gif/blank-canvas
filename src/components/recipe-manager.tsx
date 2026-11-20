import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { changeRecipe, listRecipes, type RecipeAction } from "@/lib/recipe.functions";
import { recipeSchema, type Recipe } from "@/lib/recipe-schema";

const fields = [
  { name: "code", label: "Código", required: true, maxLength: 40 },
  { name: "name", label: "Nome da receita", required: true, maxLength: 120 },
  { name: "category", label: "Categoria", required: true, maxLength: 80 },
  { name: "yield_units", label: "Rendimento (unidades)", required: true, min: 1, step: 1 },
  { name: "unit_weight_grams", label: "Peso médio por unidade (g)", min: 0, step: "any" },
  { name: "prep_minutes", label: "Tempo de preparo (min)", min: 0, step: 1 },
  { name: "oven_minutes", label: "Tempo de forno (min)", min: 0, step: 1 },
  { name: "oven_temperature_c", label: "Temperatura do forno (°C)", min: 0, step: "any" },
  { name: "description", label: "Descrição", multiline: true, maxLength: 3000 },
  { name: "instructions", label: "Modo de preparo", multiline: true, maxLength: 12000 },
  { name: "notes", label: "Observações", multiline: true, maxLength: 3000 },
] as const;

type Panel = { mode: "create" } | { mode: "view" | "edit" | "deactivate"; recipe: Recipe };
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export function RecipeManager({ userId }: { userId: string }) {
  const list = useServerFn(listRecipes);
  const change = useServerFn(changeRecipe);
  const query = useQuery({
    queryKey: ["recipe-sheets", userId],
    queryFn: () => list(),
    retry: false,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const recipes = query.data ?? [];
  const categories = [...new Set(recipes.map((recipe) => recipe.category))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
  const selectedCategory = categories.includes(category) ? category : "";
  const visible = recipes.filter(
    (recipe) =>
      recipe.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) &&
      (!selectedCategory || recipe.category === selectedCategory),
  );
  const current = panel && "recipe" in panel ? panel.recipe : undefined;
  const view = panel?.mode === "view";
  const deactivating = panel?.mode === "deactivate";

  function openPanel(next: Panel | null) {
    setError("");
    setPanel(next);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!panel || panel.mode === "view" || busy) return;
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    const optionalNumber = (key: string) => (value(key) === "" ? null : Number(value(key)));
    let action: RecipeAction;
    if (panel.mode === "deactivate") {
      action = { action: "deactivate", id: panel.recipe.id };
    } else {
      const result = recipeSchema.safeParse({
        code: value("code"),
        name: value("name"),
        category: value("category"),
        yield_units: Number(value("yield_units")),
        unit_weight_grams: optionalNumber("unit_weight_grams"),
        prep_minutes: optionalNumber("prep_minutes"),
        oven_minutes: optionalNumber("oven_minutes"),
        oven_temperature_c: optionalNumber("oven_temperature_c"),
        description: value("description"),
        instructions: value("instructions"),
        notes: value("notes"),
        active: value("active") === "true",
      });
      if (!result.success) {
        const field = fields.find(({ name }) => name === result.error.issues[0]?.path[0]);
        setError(`Confira o campo ${field?.label ?? "Status"} e informe um valor válido.`);
        return;
      }
      action =
        panel.mode === "create"
          ? { action: "create", fields: result.data }
          : { action: "edit", id: panel.recipe.id, fields: result.data };
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const outcome = await change({ data: action });
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      openPanel(null);
      setMessage(deactivating ? "Receita inativada." : "Receita salva.");
      await query.refetch();
    } catch {
      setError("Não foi possível confirmar a gravação. Confira a lista antes de tentar novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" aria-label="Lista de fichas técnicas">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid flex-1 gap-1 text-sm font-medium">
          Buscar por nome
          <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Categoria
          <select
            className={selectClass}
            value={selectedCategory}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <Button onClick={() => openPanel({ mode: "create" })} disabled={!query.isSuccess || busy}>
          Nova Receita
        </Button>
      </div>
      {message && <p role="status">{message}</p>}
      {query.isPending && <p role="status">Carregando receitas…</p>}
      {query.isError && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          Não foi possível carregar as receitas.
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      )}
      {query.isSuccess &&
        (visible.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-sm">
            {recipes.length
              ? "Nenhuma receita encontrada para estes filtros."
              : "Nenhuma receita cadastrada."}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  {["Código", "Nome", "Categoria", "Rendimento", "Status", "Ações"].map((label) => (
                    <th key={label} scope="col" className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((recipe) => (
                  <tr key={recipe.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{recipe.code}</td>
                    <th scope="row" className="px-4 py-3 font-medium">
                      {recipe.name}
                    </th>
                    <td className="px-4 py-3">{recipe.category}</td>
                    <td className="px-4 py-3">{recipe.yield_units} un.</td>
                    <td className="px-4 py-3">{recipe.active ? "Ativa" : "Inativa"}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Visualizar ${recipe.name}`}
                          onClick={() => openPanel({ mode: "view", recipe })}
                        >
                          Visualizar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Editar ${recipe.name}`}
                          onClick={() => openPanel({ mode: "edit", recipe })}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          aria-label={`Inativar ${recipe.name}`}
                          disabled={!recipe.active}
                          onClick={() => openPanel({ mode: "deactivate", recipe })}
                        >
                          Inativar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open && !busy) openPanel(null);
        }}
      >
        {panel && (
          <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {panel.mode === "create"
                  ? "Nova Receita"
                  : panel.mode === "edit"
                    ? "Editar receita"
                    : deactivating
                      ? "Inativar receita"
                      : current?.name}
              </DialogTitle>
              <DialogDescription>
                {deactivating
                  ? `Inativar ${current?.name}? A ficha continuará disponível para consulta.`
                  : view
                    ? "Dados da ficha técnica."
                    : "Código, nome, categoria e rendimento são obrigatórios."}
              </DialogDescription>
            </DialogHeader>
            {view && current ? (
              <dl className="grid gap-3 sm:grid-cols-2">
                {fields.map((field) => (
                  <div key={field.name} className={"multiline" in field ? "sm:col-span-2" : ""}>
                    <dt className="text-sm font-medium">{field.label}</dt>
                    <dd className="text-sm whitespace-pre-wrap break-words">
                      {current[field.name] === "" || current[field.name] === null
                        ? "—"
                        : current[field.name]}
                    </dd>
                  </div>
                ))}
                <div>
                  <dt className="text-sm font-medium">Status</dt>
                  <dd className="text-sm">{current.active ? "Ativa" : "Inativa"}</dd>
                </div>
              </dl>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {!deactivating && (
                  <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
                    {fields.map((field) => (
                      <label
                        key={field.name}
                        className={`grid gap-1 text-sm font-medium ${"multiline" in field ? "sm:col-span-2" : ""}`}
                      >
                        {field.label}
                        {"multiline" in field ? (
                          <Textarea
                            name={field.name}
                            maxLength={field.maxLength}
                            defaultValue={current?.[field.name] ?? ""}
                          />
                        ) : "min" in field ? (
                          <Input
                            name={field.name}
                            type="number"
                            min={field.min}
                            step={field.step}
                            required={"required" in field}
                            defaultValue={current?.[field.name] ?? ""}
                          />
                        ) : (
                          <Input
                            name={field.name}
                            required
                            maxLength={field.maxLength}
                            defaultValue={current?.[field.name] ?? ""}
                          />
                        )}
                      </label>
                    ))}
                    <label className="grid gap-1 text-sm font-medium">
                      Status
                      <select
                        name="active"
                        className={selectClass}
                        defaultValue={String(current?.active ?? true)}
                      >
                        <option value="true">Ativa</option>
                        <option value="false">Inativa</option>
                      </select>
                    </label>
                  </fieldset>
                )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => openPanel(null)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant={deactivating ? "destructive" : "default"}
                    disabled={busy}
                  >
                    {busy ? "Salvando…" : deactivating ? "Inativar receita" : "Salvar receita"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        )}
      </Dialog>
    </section>
  );
}
