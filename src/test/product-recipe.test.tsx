import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProductManager } from "@/components/product-manager";
import { businessSchema, emptyBusinessData, type BusinessData } from "@/lib/business-schema";
import { useBusinessStore } from "@/lib/business-store";
import { useLinkedRecipes } from "@/lib/use-linked-recipes";
import type { Recipe, RecipeMaterial } from "@/lib/recipe-schema";

vi.mock("@/lib/business-store", () => ({ useBusinessStore: vi.fn() }));
vi.mock("@/lib/use-linked-recipes", () => ({ useLinkedRecipes: vi.fn() }));

it("links an active sheet once, reloads it, and updates the package estimate without changing the sale price or production snapshot", async () => {
  const sheet: Recipe = {
    id: "73f90be5-ffb9-4aa5-9112-b1e4e771b86a",
    code: "CT-1",
    name: "Cookies Tradicionais — Teste",
    category: "Cookies",
    description: "",
    instructions: "",
    notes: "",
    active: true,
    yield_units: 20,
    unit_weight_grams: null,
    prep_minutes: null,
    oven_minutes: null,
    oven_temperature_c: null,
    ingredients: [
      { material_id: "farinha", quantity: 500, unit: "g" },
      { material_id: "manteiga", quantity: 250, unit: "g" },
      { material_id: "acucar", quantity: 220, unit: "g" },
    ],
  };
  const ingredients: RecipeMaterial[] = [
    { id: "farinha", name: "Farinha", unit: "kg", unitCost: "8" },
    { id: "manteiga", name: "Manteiga", unit: "kg", unitCost: "44" },
    { id: "acucar", name: "Açúcar", unit: "kg", unitCost: "8" },
  ];
  let data = {
    ...emptyBusinessData,
    materials: ingredients.map((item) => ({
      ...item,
      unitCost: Number(item.unitCost),
      quantity: 10,
      minimum: 0,
    })),
  } satisfies BusinessData as BusinessData;
  const commit = vi.fn(async (next: BusinessData) => {
    data = businessSchema.parse(JSON.parse(JSON.stringify(next)));
    return true;
  });
  vi.mocked(useBusinessStore).mockImplementation(() => ({ data, commit }));
  let sheets = [
    sheet,
    { ...sheet, id: "02482806-ec5e-4a49-94bc-9bda97b56ca9", name: "Ficha inativa", active: false },
  ];
  vi.mocked(useLinkedRecipes).mockImplementation(() => ({
    recipes: { data: sheets, isError: false, isPending: false } as ReturnType<
      typeof useLinkedRecipes
    >["recipes"],
    materialsById: new Map(ingredients.map((item) => [item.id, item])),
    unavailable: false,
  }));
  const onViewRecipe = vi.fn();
  const manager = <ProductManager userId="conta-teste" onViewRecipe={onViewRecipe} />;
  const view = render(manager);
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar produto" }));
  fireEvent.change(screen.getByLabelText("Nome do produto"), {
    target: { value: "Cookies pacote com 10" },
  });
  expect(screen.queryByRole("option", { name: /Ficha inativa/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Receita vinculada"), { target: { value: sheet.id } });
  fireEvent.change(screen.getByLabelText("Unidades por apresentação comercial"), {
    target: { value: "10" },
  });
  expect(screen.getByText("R$ 8,38")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Salvar produto e receita" }));
  await waitFor(() =>
    expect(screen.getByText("Cookies pacote com 10 foi salvo.")).toBeInTheDocument(),
  );
  const product = data.products[0]!;
  expect(product).toMatchObject({
    recipe_sheet_id: sheet.id,
    units_per_presentation: 10,
    recipe: [],
  });
  data = { ...data, prices: { [product.id]: 23 } };
  view.unmount();
  const reopened = render(manager);
  expect(screen.getByText("R$ 8,38")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Consultar receita vinculada" }));
  expect(onViewRecipe).toHaveBeenCalledWith(sheet.id);
  fireEvent.click(screen.getByRole("button", { name: "Produzir" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar produção" }));
  await waitFor(() =>
    expect(data.productions[0]).toMatchObject({ units: 2, ingredient_cost: 16.76 }),
  );
  sheets = [{ ...sheet, yield_units: 40 }, sheets[1]!];
  reopened.rerender(<ProductManager userId="conta-teste" onViewRecipe={onViewRecipe} />);
  expect(screen.getByText("R$ 4,19")).toBeInTheDocument();
  expect(screen.getByText(/Custo de ingredientes registrado: R\$ 16,76/)).toBeInTheDocument();
  expect(screen.getByLabelText("Preço de venda de Cookies pacote com 10")).toHaveValue(23);
});
