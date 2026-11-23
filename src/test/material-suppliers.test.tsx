import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MaterialSuppliers } from "@/components/material-suppliers";
import { readMaterialSuppliers } from "@/lib/material-supplier.functions";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/material-supplier.functions", () => ({ readMaterialSuppliers: vi.fn(), writeMaterialSupplier: vi.fn() }));
vi.mock("@/lib/supplier.functions", () => ({ listSuppliers: async () => [] }));

it("destaca a menor cotação disponível e identifica o principal independentemente do preço", async () => {
  const history = { price: 30, quantity: 5, unit: "kg", date: "2026-11-01", recorded: "2026-11-01T12:00:00Z", author: "qa", equivalent: 6 };
  vi.mocked(readMaterialSuppliers).mockResolvedValue([
    { linked: true, supplier_id: "a", name: "QA A", active: true, notes: "", is_primary: false, history: [history] },
    { linked: true, supplier_id: "b", name: "QA B", active: true, notes: "", is_primary: true, history: [{ ...history, quantity: 1, price: 7.5, equivalent: 7.5 }] },
    { linked: true, supplier_id: "c", name: "QA C", active: false, notes: "", is_primary: false, history: [{ ...history, equivalent: 1 }] },
  ]);
  render(<QueryClientProvider client={new QueryClient()}><MaterialSuppliers material={{id:"qa", name:"Farinha QA", unit:"kg"}} userId="qa" close={() => {}}/></QueryClientProvider>);
  const winner = await screen.findByText("Menor preço equivalente cotado");
  expect(within(winner.closest("section")!).getByText("QA A")).toBeInTheDocument();
  expect(screen.getByText("QA B · Principal")).toBeInTheDocument();
  expect(screen.getAllByText("Menor preço equivalente cotado")).toHaveLength(1);
});
