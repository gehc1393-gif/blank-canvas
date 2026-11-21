import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { InventoryManager } from "@/components/inventory-manager";
import { useBusinessStore } from "@/lib/business-store";
import { businessSchema, emptyBusinessData, type BusinessData } from "@/lib/business-schema";

vi.mock("@/lib/business-store", () => ({ useBusinessStore: vi.fn() }));

it("registers and reloads an ingredient with its cost and initial stock movement", async () => {
  let data: BusinessData = emptyBusinessData;
  const commit = vi.fn(async (next: BusinessData) => {
    data = businessSchema.parse(JSON.parse(JSON.stringify(next)));
    return true;
  });
  vi.mocked(useBusinessStore).mockImplementation(() => ({ data, commit }));
  const first = render(<InventoryManager />);
  fireEvent.click(screen.getByRole("button", { name: "Cadastrar matéria-prima" }));
  fireEvent.change(screen.getByLabelText("Nome do ingrediente"), {
    target: { value: "Farinha de teste" },
  });
  fireEvent.change(screen.getByLabelText("Quantidade inicial"), { target: { value: "2.5" } });
  fireEvent.change(screen.getByLabelText("Custo por unidade (R$)"), { target: { value: "8" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvar ingrediente" }));
  await screen.findByText("Farinha de teste foi adicionada ao estoque.");
  expect(data.materials).toEqual([
    expect.objectContaining({ name: "Farinha de teste", unit: "kg", unitCost: 8, quantity: 2.5 }),
  ]);
  expect(data.movements).toEqual([
    expect.objectContaining({ kind: "entrada", quantity: 2.5, materialId: data.materials[0]?.id }),
  ]);
  first.unmount();
  render(<InventoryManager />);
  expect(screen.getByRole("cell", { name: "Farinha de teste" })).toBeInTheDocument();
});
