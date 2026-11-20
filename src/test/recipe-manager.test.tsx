import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RecipeManager } from "@/components/recipe-manager";
import {
  changeRecipe,
  listRecipeMaterials,
  listRecipes,
  type RecipeAction,
} from "@/lib/recipe.functions";
import {
  convertIngredientQuantity,
  recipeIngredientsSchema,
  type Recipe,
} from "@/lib/recipe-schema";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/recipe.functions", () => ({
  changeRecipe: vi.fn(),
  listRecipes: vi.fn(),
  listRecipeMaterials: vi.fn(),
}));

it("validates yield, then creates, filters, views, edits and deactivates a recipe with server responses", async () => {
  let records: Recipe[] = [];
  vi.mocked(listRecipes).mockImplementation(async () => records);
  vi.mocked(listRecipeMaterials).mockResolvedValue([
    { id: "farinha", name: "Farinha", unit: "kg", unitCost: "8" },
    { id: "leite", name: "Leite", unit: "L", unitCost: "10" },
  ]);
  vi.mocked(changeRecipe).mockImplementation(async (options) => {
    const action = (options as { data: RecipeAction }).data;
    if (action.action === "create") {
      records = [...records, { ...action.fields, id: "73f90be5-ffb9-4aa5-9112-b1e4e771b86a" }];
    } else {
      records = records.map((item) =>
        item.id === action.id
          ? { ...item, ...(action.action === "edit" ? action.fields : { active: false }) }
          : item,
      );
    }
    return { ok: true };
  });
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <RecipeManager userId="test-account" />
    </QueryClientProvider>,
  );
  await screen.findByText("Nenhuma receita cadastrada.");
  fireEvent.click(screen.getByRole("button", { name: "Nova Receita" }));
  const form = within(screen.getByRole("dialog"));
  fireEvent.change(form.getByLabelText("Código"), { target: { value: "f-01" } });
  fireEvent.change(form.getByLabelText("Nome da receita"), { target: { value: "Ficha de teste" } });
  fireEvent.change(form.getByLabelText("Categoria"), { target: { value: "Categoria de teste" } });
  const yieldField = form.getByLabelText("Rendimento (unidades)");
  fireEvent.change(yieldField, { target: { value: "0" } });
  fireEvent.submit(form.getByRole("button", { name: "Salvar receita" }).closest("form")!);
  expect(form.getByRole("alert")).toHaveTextContent("Rendimento");
  expect(changeRecipe).not.toHaveBeenCalled();
  fireEvent.change(yieldField, { target: { value: "12" } });
  const add = await form.findByRole("button", { name: "Adicionar ingrediente" });
  await waitFor(() => expect(add).toBeEnabled());
  fireEvent.click(add);
  fireEvent.change(form.getByLabelText("Ingrediente 1"), { target: { value: "farinha" } });
  fireEvent.change(form.getByLabelText("Quantidade utilizada 1"), { target: { value: "0" } });
  fireEvent.submit(form.getByRole("button", { name: "Salvar receita" }).closest("form")!);
  expect(form.getByRole("alert")).toHaveTextContent("quantidades maiores que zero");
  expect(changeRecipe).not.toHaveBeenCalled();
  fireEvent.change(form.getByLabelText("Quantidade utilizada 1"), { target: { value: "0.25" } });
  fireEvent.change(form.getByLabelText("Unidade de medida 1"), { target: { value: "g" } });
  expect(form.getByLabelText("Quantidade utilizada 1")).toHaveValue(250);
  fireEvent.click(add);
  expect(
    within(form.getByLabelText("Ingrediente 2")).getByRole("option", { name: "Farinha" }),
  ).toBeDisabled();
  fireEvent.change(form.getByLabelText("Ingrediente 2"), { target: { value: "leite" } });
  fireEvent.change(form.getByLabelText("Quantidade utilizada 2"), { target: { value: "0.1" } });
  fireEvent.change(form.getByLabelText("Unidade de medida 2"), { target: { value: "ml" } });
  expect(form.getByLabelText("Quantidade utilizada 2")).toHaveValue(100);
  expect(form.getByText("R$ 8,00 / kg")).toBeInTheDocument();
  expect(form.getByText("R$ 3,00")).toBeInTheDocument();
  expect(form.getByText("R$ 0,25")).toBeInTheDocument();
  fireEvent.change(yieldField, { target: { value: "24" } });
  expect(form.getByText("R$ 0,13")).toBeInTheDocument();
  fireEvent.change(yieldField, { target: { value: "12" } });
  fireEvent.click(form.getByRole("button", { name: "Salvar receita" }));
  await screen.findByRole("rowheader", { name: "Ficha de teste" });
  expect(screen.getByText("F-01")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "outra" } });
  expect(screen.getByText("Nenhuma receita encontrada para estes filtros.")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Categoria" }), {
    target: { value: "Categoria de teste" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Visualizar Ficha de teste" }));
  expect(within(screen.getByRole("dialog")).getByText("12")).toBeInTheDocument();
  expect(await screen.findByRole("rowheader", { name: "Farinha" })).toBeInTheDocument();
  expect(screen.getByText("100 ml")).toBeInTheDocument();
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Editar Ficha de teste" }));
  fireEvent.change(screen.getByLabelText("Rendimento (unidades)"), { target: { value: "18" } });
  expect(screen.getByLabelText("Ingrediente 1")).toHaveValue("farinha");
  expect(screen.getByLabelText("Quantidade utilizada 1")).toHaveValue(250);
  fireEvent.change(screen.getByLabelText("Quantidade utilizada 1"), { target: { value: "300" } });
  fireEvent.click(screen.getByRole("button", { name: "Remover ingrediente 2" }));
  fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }));
  await screen.findByText("18 un.");
  fireEvent.click(screen.getByRole("button", { name: "Editar Ficha de teste" }));
  expect(screen.getByLabelText("Quantidade utilizada 1")).toHaveValue(300);
  expect(screen.queryByLabelText("Ingrediente 2")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }));
  await screen.findByRole("button", { name: "Inativar Ficha de teste" });
  expect(records[0]?.ingredients).toEqual([{ material_id: "farinha", quantity: 300, unit: "g" }]);
  fireEvent.click(screen.getByRole("button", { name: "Inativar Ficha de teste" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Inativar receita" }),
  );
  await screen.findByText("Inativa");
  expect(screen.getByRole("button", { name: "Inativar Ficha de teste" })).toBeDisabled();
});

it("converts only within the same dimension and rejects repeated or nonpositive entries", () => {
  expect(convertIngredientQuantity(1.001, "kg", "g")).toBe(1001);
  expect(convertIngredientQuantity(1001, "g", "kg")).toBe(1.001);
  expect(convertIngredientQuantity(1.001, "L", "ml")).toBe(1001);
  expect(convertIngredientQuantity(1001, "ml", "L")).toBe(1.001);
  expect(convertIngredientQuantity(1, "g", "ml")).toBeUndefined();
  expect(convertIngredientQuantity(1, "unidade", "pacote")).toBeUndefined();
  const item = { material_id: "farinha", quantity: 1, unit: "g" };
  expect(recipeIngredientsSchema.safeParse([item, item]).success).toBe(false);
  expect(recipeIngredientsSchema.safeParse([{ ...item, quantity: -1 }]).success).toBe(false);
});
