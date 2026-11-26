import Decimal from "decimal.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProductPackaging } from "@/components/product-packaging";

const fixture = vi.hoisted(() => ({
  price: 40,
  links: [
    { id: "s", quantity: 1 },
    { id: "e", quantity: 1 },
    { id: "f", quantity: 0.3 },
  ],
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/product-packaging.functions", () => ({
  readComposition: async () => fixture.links,
  saveComposition: vi.fn(),
}));
vi.mock("@/lib/packaging.functions", () => ({
  listPackaging: async () => ({
    rows: [
      {
        id: "s",
        code: "S",
        name: "Saco",
        purchase_price: fixture.price,
        purchase_quantity: 50,
        use_unit: "unidade",
        stock_balance: 0,
        active: true,
      },
      {
        id: "e",
        code: "E",
        name: "Etiqueta",
        purchase_price: 35,
        purchase_quantity: 100,
        use_unit: "unidade",
        stock_balance: 75,
        active: true,
      },
      {
        id: "f",
        code: "F",
        name: "Fita",
        purchase_price: 15,
        purchase_quantity: 10,
        use_unit: "m",
        stock_balance: 9.7,
        active: true,
      },
    ],
  }),
}));
function open() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <ProductPackaging product="qa" userId="qa" ingredients={new Decimal("8.38")} price={21} />
    </QueryClientProvider>,
  );
}
it.each([
  [40, "9,98"],
  [50, "10,18"],
] as const)("exibe o combinado atualizado com saco de %s", async (price, total) => {
  fixture.price = price;
  open();
  await screen.findByText("Ingredientes + embalagens: R$ " + total);
  expect(screen.getByText("Preço de venda atual: R$ 21,00")).toBeInTheDocument();
  expect(screen.getByText(/Estoque insuficiente/)).toBeInTheDocument();
});
it("distingue preço pendente de composição vazia", async () => {
  fixture.price = 0;
  const first = open();
  await screen.findByText("Custo de embalagem pendente.");
  expect(screen.getByText("Ingredientes + embalagens: —")).toBeInTheDocument();
  first.unmount();
  fixture.links = [];
  open();
  await screen.findByText("Sem embalagem configurada.");
  expect(screen.queryByText("Custo de embalagem pendente.")).toBeNull();
});
