import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SupplierManager } from "@/components/supplier-manager";
import { blankSupplier } from "@/lib/supplier-schema";
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/supplier.functions", () => ({ saveSupplier: vi.fn(), listSuppliers: async () => [
  {...blankSupplier,id:"a",code:1,name:"QA A",trade_name:"Farinha",active:true},
  {...blankSupplier,id:"b",code:2,name:"QA B",trade_name:"Farinha antiga",active:false},
]}));
it("combina pesquisa por nome fantasia com o filtro de situação", async () => {
  render(<QueryClientProvider client={new QueryClient()}><SupplierManager userId="qa"/></QueryClientProvider>);
  await screen.findByText("#1 · QA A");
  const search = screen.getByLabelText("Pesquisar por nome ou empresa");
  fireEvent.change(search,{target:{value:"farinha"}});
  fireEvent.change(screen.getByLabelText("Situação"),{target:{value:"inativos"}});
  expect(screen.queryByText("#1 · QA A")).toBeNull();
  expect(screen.getByText("#2 · QA B")).toBeInTheDocument();
  fireEvent.change(search,{target:{value:"inexistente"}});
  expect(screen.getByText("Nenhum fornecedor encontrado.")).toBeInTheDocument();
});
