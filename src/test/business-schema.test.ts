import { describe, expect, it } from "vitest";
import { businessSchema, emptyBusinessData } from "@/lib/business-schema";

const material = { id: "flour", name: "Farinha", unit: "kg", quantity: 10, minimum: 1, unitCost: 5 };
const product = { id: "cookie", name: "Bolacha", batchYield: 12, recipe: [{ materialId: "flour", quantity: 0.5 }], producedUnits: 12, createdAt: "2026-11-15T23:00:00Z" };
describe("Business persistence validation", () => {
  it("accepts a complete production and sale with existing ingredients", () => {
    expect(businessSchema.safeParse({ ...emptyBusinessData, materials: [material], products: [product], sales: [{ id: "sale", productId: "cookie", quantity: 12, unitPrice: 2, unitCost: 0.25, soldAt: product.createdAt }] }).success).toBe(true);
  });
  it("rejects sales above produced stock", () => {
    expect(businessSchema.safeParse({ ...emptyBusinessData, materials: [material], products: [product], sales: [{ id: "sale", productId: "cookie", quantity: 13, unitPrice: 2, unitCost: 0.25, soldAt: product.createdAt }] }).success).toBe(false);
  });
  it("rejects negative stock", () => {
    expect(businessSchema.safeParse({ ...emptyBusinessData, materials: [{ ...material, quantity: -1 }] }).success).toBe(false);
  });
  it("rejects recipes referencing absent materials", () => {
    expect(businessSchema.safeParse({ ...emptyBusinessData, products: [product] }).success).toBe(false);
  });
});