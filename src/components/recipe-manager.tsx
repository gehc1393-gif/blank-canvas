import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { formatRecipeDate, recipeAuthor, RecipeHistory } from "@/components/recipe-history";
import {
  calculateIngredientCost,
  formatIngredientCost,
  summarizeIngredientCosts,
} from "@/lib/recipe-cost";
import {
  changeRecipe,
  listRecipeMaterials,
  listRecipes,
  type RecipeAction,
} from "@/lib/recipe.functions";
import {
  compatibleUnits,
  convertIngredientQuantity,
  recipeIngredientsSchema,
  recipeSchema,
  type Recipe,
  type RecipeIngredient,
  type RecipeMaterial,
  type RecipeVersion,
} from "@/lib/recipe-schema";

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

type Panel =
  | { mode: "create" }
  | { mode: "duplicate"; recipe: Recipe; code: string }
  | { mode: "view" | "edit" | "deactivate"; recipe: Recipe };
type IngredientDraft = Omit<RecipeIngredient, "quantity"> & { key: string; quantity: string };
const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export function RecipeManager({
  userId,
  initialRecipeId,
}: {
  userId: string;
  initialRecipeId?: string | undefined;
}) {
  const list = useServerFn(listRecipes);
  const change = useServerFn(changeRecipe);
  const listMaterials = useServerFn(listRecipeMaterials);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["recipe-sheets", userId],
    queryFn: () => list(),
    retry: false,
  });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [openedPanel, setPanel] = useState<Panel | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<RecipeVersion | null>(null);
  const [requestedId, setRequestedId] = useState(initialRecipeId);
  const requested = query.data?.find((recipe) => recipe.id === requestedId);
  const panel: Panel | null =
    openedPanel ?? (requested ? { mode: "view", recipe: requested } : null);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [yieldDraft, setYieldDraft] = useState("");
  const materialsQuery = useQuery({
    queryKey: ["recipe-materials", userId],
    queryFn: () => listMaterials(),
    enabled: panel !== null && panel.mode !== "deactivate",
    retry: false,
  });
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
  const savedRecipe = panel && "recipe" in panel ? panel.recipe : undefined;
  const current =
    savedRecipe && selectedVersion ? { ...savedRecipe, ...selectedVersion.snapshot } : savedRecipe;
  const view = panel?.mode === "view";
  const deactivating = panel?.mode === "deactivate";
  const materials = materialsQuery.data ?? [];
  const materialsById = new Map(materials.map((material) => [material.id, material]));
  const shownIngredients = view ? (current?.ingredients ?? []) : ingredients;
  const yieldUnits = view ? (current?.yield_units ?? 0) : Number(yieldDraft);
  const costs = shownIngredients.map((item) =>
    calculateIngredientCost(item.quantity, item.unit, materialsById.get(item.material_id)),
  );
  const costSummary = summarizeIngredientCosts(costs, yieldUnits);

  function openPanel(next: Panel | null) {
    setSelectedVersion(null);
    setRequestedId(undefined);
    setError("");
    setYieldDraft(next && "recipe" in next ? String(next.recipe.yield_units) : "");
    setIngredients(
      next && "recipe" in next
        ? next.recipe.ingredients.map((item) => ({
            ...item,
            key: item.material_id,
            quantity: String(item.quantity),
          }))
        : [],
    );
    setPanel(next);
  }

  function updateIngredient(key: string, changes: Partial<IngredientDraft>) {
    setIngredients((items) =>
      items.map((item) => (item.key === key ? { ...item, ...changes } : item)),
    );
  }

  function changeIngredientUnit(item: IngredientDraft, unit: string) {
    const quantity = Number(item.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      updateIngredient(item.key, { unit });
      return;
    }
    const converted = convertIngredientQuantity(quantity, item.unit, unit);
    if (converted === undefined) {
      setError("A quantidade está fora do intervalo permitido para essa conversão.");
      return;
    }
    setError("");
    updateIngredient(item.key, { unit, quantity: String(converted) });
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
      const parsedIngredients = recipeIngredientsSchema.safeParse(
        ingredients.map(({ material_id, quantity, unit }) => ({
          material_id,
          quantity: Number(quantity),
          unit,
        })),
      );
      if (!parsedIngredients.success) {
        setError(
          "Selecione um ingrediente por linha, sem repetir, e informe quantidades maiores que zero.",
        );
        return;
      }
      const recipeFields = { ...result.data, ingredients: parsedIngredients.data };
      action =
        panel.mode === "edit"
          ? { action: "edit", id: panel.recipe.id, fields: recipeFields }
          : { action: "create", fields: recipeFields };
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
      setMessage(
        deactivating
          ? "Receita inativada."
          : panel.mode === "duplicate"
            ? "Variação criada."
            : "Receita salva.",
      );
      if (savedRecipe && panel.mode !== "duplicate") {
        void queryClient.invalidateQueries({
          queryKey: ["recipe-history", userId, savedRecipe.id],
        });
      }
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
                          aria-label={`Duplicar ${recipe.name}`}
                          onClick={() =>
                            openPanel({
                              mode: "duplicate",
                              recipe,
                              code: `FT-${crypto.randomUUID().toUpperCase()}`,
                            })
                          }
                        >
                          Duplicar
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
          <DialogContent className="max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>
                {panel.mode === "create"
                  ? "Nova Receita"
                  : panel.mode === "duplicate"
                    ? "Duplicar receita"
                    : panel.mode === "edit"
                      ? "Editar receita"
                      : deactivating
                        ? "Inativar receita"
                        : selectedVersion
                          ? `${current?.name} — versão ${selectedVersion.version}`
                          : current?.name}
              </DialogTitle>
              <DialogDescription>
                {deactivating
                  ? `Inativar ${current?.name}? A ficha continuará disponível para consulta.`
                  : view
                    ? selectedVersion
                      ? "Ficha arquivada. Os custos exibidos usam os preços atuais do estoque."
                      : "Dados da ficha técnica."
                    : panel.mode === "duplicate"
                      ? "Revise o nome e os dados da variação antes de salvar."
                      : "Código, nome, categoria e rendimento são obrigatórios."}
              </DialogDescription>
            </DialogHeader>
            {view && current && savedRecipe ? (
              <>
                {selectedVersion && (
                  <Button type="button" variant="outline" onClick={() => setSelectedVersion(null)}>
                    Voltar à ficha atual
                  </Button>
                )}
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
                  <div>
                    <dt className="text-sm font-medium">Criada em</dt>
                    <dd className="text-sm">{formatRecipeDate(savedRecipe.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium">
                      {selectedVersion ? "Versão registrada em" : "Última alteração"}
                    </dt>
                    <dd className="text-sm">
                      {formatRecipeDate(selectedVersion?.changed_at ?? savedRecipe.updatedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium">Responsável</dt>
                    <dd className="break-all text-sm">
                      {recipeAuthor(
                        selectedVersion ? selectedVersion.changed_by : savedRecipe.updatedBy,
                        userId,
                      )}
                    </dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-sm font-medium">Ingredientes da Receita</dt>
                    <dd className="text-sm">
                      {current.ingredients.length === 0 ? (
                        "Nenhum ingrediente cadastrado."
                      ) : (
                        <div className="mt-2 overflow-x-auto rounded-md border">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="border-b">
                                {[
                                  "Ingrediente",
                                  "Quantidade utilizada",
                                  "Preço de referência",
                                  "Custo utilizado",
                                ].map((label) => (
                                  <th key={label} scope="col" className="p-2">
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {current.ingredients.map((item, index) => {
                                const material = materialsById.get(item.material_id);
                                return (
                                  <tr key={item.material_id} className="border-b last:border-0">
                                    <th scope="row" className="p-2 font-medium">
                                      {material?.name ??
                                        (materialsQuery.isPending
                                          ? "Carregando nome…"
                                          : "Ingrediente indisponível")}
                                    </th>
                                    <td className="p-2 whitespace-nowrap">
                                      {item.quantity.toLocaleString("pt-BR", {
                                        maximumSignificantDigits: 17,
                                      })}{" "}
                                      {item.unit}
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                      {referencePrice(material)}
                                    </td>
                                    <td className="p-2 whitespace-nowrap">
                                      {formatIngredientCost(costs[index] ?? null)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <IngredientCostSummary summary={costSummary} yieldUnits={yieldUnits} />
                    </dd>
                  </div>
                </dl>
                <RecipeHistory
                  recipeId={savedRecipe.id}
                  userId={userId}
                  onSelect={setSelectedVersion}
                />
              </>
            ) : (
              <form onSubmit={submit} className="min-w-0 space-y-4">
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
                            value={field.name === "yield_units" ? yieldDraft : undefined}
                            defaultValue={
                              field.name === "yield_units"
                                ? undefined
                                : (current?.[field.name] ?? "")
                            }
                            onChange={
                              field.name === "yield_units"
                                ? (event) => setYieldDraft(event.target.value)
                                : undefined
                            }
                          />
                        ) : (
                          <Input
                            name={field.name}
                            required
                            maxLength={field.maxLength}
                            readOnly={panel.mode === "duplicate" && field.name === "code"}
                            defaultValue={
                              panel.mode === "duplicate" && field.name === "code"
                                ? panel.code
                                : panel.mode === "duplicate" && field.name === "name"
                                  ? `${panel.recipe.name.slice(0, 112)} — cópia`
                                  : (current?.[field.name] ?? "")
                            }
                          />
                        )}
                      </label>
                    ))}
                    <label className="grid gap-1 text-sm font-medium">
                      Status
                      <select
                        name="active"
                        className={selectClass}
                        defaultValue={String(
                          panel.mode === "duplicate" ? true : (current?.active ?? true),
                        )}
                      >
                        <option value="true">Ativa</option>
                        <option value="false">Inativa</option>
                      </select>
                    </label>
                  </fieldset>
                )}
                {!deactivating && (
                  <fieldset disabled={busy} className="min-w-0 space-y-3 border-t pt-3">
                    <legend className="text-sm font-semibold">Ingredientes da Receita</legend>
                    {materialsQuery.isPending && (
                      <p role="status" className="text-sm">
                        Carregando ingredientes do estoque…
                      </p>
                    )}
                    {materialsQuery.isError && (
                      <p role="alert" className="flex flex-wrap items-center gap-2 text-sm">
                        Não foi possível carregar o estoque.
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void materialsQuery.refetch()}
                        >
                          Tentar novamente
                        </Button>
                      </p>
                    )}
                    {materialsQuery.isSuccess && !materials.length && (
                      <p className="text-sm">
                        Cadastre uma matéria-prima em Estoque para adicioná-la aqui.
                      </p>
                    )}
                    {ingredients.length > 0 && (
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead>
                            <tr className="border-b">
                              {[
                                "Ingrediente",
                                "Quantidade utilizada",
                                "Unidade de medida",
                                "Preço de referência",
                                "Custo utilizado",
                                "Ações",
                              ].map((label) => (
                                <th key={label} scope="col" className="px-2 py-2">
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {ingredients.map((item, index) => {
                              const material = materialsById.get(item.material_id);
                              const units = compatibleUnits(material?.unit ?? item.unit);
                              return (
                                <tr key={item.key} className="border-b last:border-0">
                                  <td className="p-2">
                                    <select
                                      aria-label={`Ingrediente ${index + 1}`}
                                      className={selectClass}
                                      value={item.material_id}
                                      required
                                      onChange={(event) => {
                                        const selected = materialsById.get(event.target.value);
                                        updateIngredient(item.key, {
                                          material_id: selected?.id ?? "",
                                          unit: selected?.unit ?? "",
                                          quantity: "",
                                        });
                                      }}
                                    >
                                      <option value="">Selecione</option>
                                      {item.material_id && !material && (
                                        <option value={item.material_id}>
                                          Ingrediente indisponível
                                        </option>
                                      )}
                                      {materials.map((entry) => (
                                        <option
                                          key={entry.id}
                                          value={entry.id}
                                          disabled={ingredients.some(
                                            (other) =>
                                              other.key !== item.key &&
                                              other.material_id === entry.id,
                                          )}
                                        >
                                          {entry.name}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-2">
                                    <Input
                                      aria-label={`Quantidade utilizada ${index + 1}`}
                                      type="number"
                                      min="0"
                                      step="any"
                                      required
                                      value={item.quantity}
                                      onChange={(event) =>
                                        updateIngredient(item.key, { quantity: event.target.value })
                                      }
                                    />
                                  </td>
                                  <td className="p-2">
                                    <select
                                      aria-label={`Unidade de medida ${index + 1}`}
                                      className={selectClass}
                                      value={item.unit}
                                      disabled={!material}
                                      onChange={(event) =>
                                        changeIngredientUnit(item, event.target.value)
                                      }
                                    >
                                      {!units.includes(item.unit) && (
                                        <option value={item.unit}>{item.unit}</option>
                                      )}
                                      {units.map((unit) => (
                                        <option key={unit} value={unit}>
                                          {unit || "—"}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="p-2 whitespace-nowrap">
                                    {referencePrice(material)}
                                  </td>
                                  <td className="p-2 whitespace-nowrap">
                                    {formatIngredientCost(costs[index] ?? null)}
                                  </td>
                                  <td className="p-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      aria-label={`Remover ingrediente ${index + 1}`}
                                      onClick={() =>
                                        setIngredients((items) =>
                                          items.filter((entry) => entry.key !== item.key),
                                        )
                                      }
                                    >
                                      Remover
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={ingredients.length >= Math.min(materials.length, 200)}
                      onClick={() =>
                        setIngredients((items) => [
                          ...items,
                          { key: crypto.randomUUID(), material_id: "", quantity: "", unit: "" },
                        ])
                      }
                    >
                      Adicionar ingrediente
                    </Button>
                    <IngredientCostSummary summary={costSummary} yieldUnits={yieldUnits} />
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

function referencePrice(material: RecipeMaterial | undefined) {
  if (!material) return "—";
  const price = formatIngredientCost(material.unitCost);
  return price === "—" ? price : `${price} / ${material.unit}`;
}

function IngredientCostSummary({
  summary,
  yieldUnits,
}: {
  summary: ReturnType<typeof summarizeIngredientCosts>;
  yieldUnits: number;
}) {
  return (
    <div className="mt-3 space-y-2 text-sm">
      <dl className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-3">
        <div>
          <dt>Custo total dos ingredientes</dt>
          <dd className="font-semibold">{formatIngredientCost(summary.total)}</dd>
        </div>
        <div>
          <dt>Rendimento da receita</dt>
          <dd className="font-semibold">
            {Number.isInteger(yieldUnits) && yieldUnits > 0 ? `${yieldUnits} un.` : "—"}
          </dd>
        </div>
        <div>
          <dt>Custo dos ingredientes por unidade</dt>
          <dd className="font-semibold">{formatIngredientCost(summary.perUnit)}</dd>
        </div>
      </dl>
      {summary.total === null && (
        <p>
          Complete as quantidades e confira os preços e as unidades do estoque para calcular o
          total.
        </p>
      )}
    </div>
  );
}
