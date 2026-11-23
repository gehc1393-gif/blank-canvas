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

it("exige confirmação para mudar o custo de referência", async () => {
  const data = { ...emptyBusinessData, materials: [{id:"qa",name:"Farinha QA",quantity:2,minimum:0,unit:"kg",unitCost:8}] };
  const commit = vi.fn(async (_next: BusinessData) => true);
  vi.mocked(useBusinessStore).mockReturnValue({ data, commit });
  const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  try {
    render(<InventoryManager />);
    fireEvent.click(screen.getByRole("button", {name:"Registrar entrada de Farinha QA"}));
    fireEvent.change(screen.getByLabelText("Quantidade (kg)"), {target:{value:"1"}});
    fireEvent.change(screen.getByLabelText(/Novo custo por unidade/), {target:{value:"7"}});
    const save = screen.getByRole("button", {name:"Salvar movimentação"});
    fireEvent.click(save);
    expect(commit).not.toHaveBeenCalled();
    fireEvent.click(save);
    expect(commit.mock.calls[0]?.[0].materials[0]?.unitCost).toBe(7);
    expect(commit.mock.calls[0]?.[0].movements[0]?.note).toContain("8 → 7 R$/kg");
    await screen.findByText("Entrada registrada para Farinha QA.");
  } finally { confirm.mockRestore(); }
});
