import { expect, it } from "vitest";
import { emptyPackaging, packagingSchema, packagingCost } from "@/lib/packaging-schema";
it.each([
  [35, 100, 1, "0.35"],
  [40, 50, 1, "0.8"],
  [15, 10, 1, "1.5"],
  [15, 10, 0.3, "0.45"],
])("calcula preço %s, compra %s e utilização %s", (p, q, u, result) => {
  expect(packagingCost(Number(p), Number(q), Number(u))?.toString()).toBe(result);
});
it("distingue custo desconhecido e valida dados sem exigir dimensões", () => {
  const valid = { ...emptyPackaging, code: "qa", name: "QA", category: "Tags" };
  expect(packagingSchema.parse(valid).code).toBe("QA");
  expect(packagingCost(0, 10)).toBeNull();
  for (const fields of [
    { name: " " },
    { width: -1 },
    { purchase_quantity: 0 },
    { purchase_price: -1 },
    { purchase_price: 1.005 },
    { dimension_unit: "kg" },
  ]) {
    expect(packagingSchema.safeParse({ ...valid, ...fields }).success).toBe(false);
  }
});
