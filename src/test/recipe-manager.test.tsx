import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RecipeManager } from "@/components/recipe-manager";
import { changeRecipe, listRecipes, type RecipeAction } from "@/lib/recipe.functions";
import type { Recipe } from "@/lib/recipe-schema";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/recipe.functions", () => ({ changeRecipe: vi.fn(), listRecipes: vi.fn() }));

it("validates yield, then creates, filters, views, edits and deactivates a recipe with server responses", async () => {
  let records: Recipe[] = [];
  vi.mocked(listRecipes).mockImplementation(async () => records);
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
  fireEvent.keyDown(document.activeElement!, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "Editar Ficha de teste" }));
  fireEvent.change(screen.getByLabelText("Rendimento (unidades)"), { target: { value: "18" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar receita" }));
  await screen.findByText("18 un.");
  fireEvent.click(screen.getByRole("button", { name: "Inativar Ficha de teste" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Inativar receita" }),
  );
  await screen.findByText("Inativa");
  expect(screen.getByRole("button", { name: "Inativar Ficha de teste" })).toBeDisabled();
});
