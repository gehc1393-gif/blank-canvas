import { expect, it } from "vitest";
import {
  calculateIngredientCost,
  formatIngredientCost,
  summarizeIngredientCosts,
} from "@/lib/recipe-cost";

it("calculates the required recipe without rounding intermediate values", () => {
  const costs = [
    calculateIngredientCost(500, "g", { id: "1", name: "Farinha", unit: "kg", unitCost: "8.00" }),
    calculateIngredientCost(250, "g", { id: "2", name: "Manteiga", unit: "kg", unitCost: "44.00" }),
    calculateIngredientCost(220, "g", { id: "3", name: "Açúcar", unit: "kg", unitCost: "8.00" }),
  ];
  expect(costs.map(formatIngredientCost)).toEqual(["R$ 4,00", "R$ 11,00", "R$ 1,76"]);
  const { total, perUnit } = summarizeIngredientCosts(costs, 20);
  expect(total?.toString()).toBe("16.76");
  expect(formatIngredientCost(total)).toBe("R$ 16,76");
  expect(perUnit?.toString()).toBe("0.838");
  expect(formatIngredientCost(perUnit)).toBe("R$ 0,84");
});

it("handles volume, sub-cent costs, zero prices and unavailable references", () => {
  const material = { id: "1", name: "Leite", unit: "L", unitCost: "4.00" };
  const cost = calculateIngredientCost(1, "ml", material);
  expect(formatIngredientCost(cost)).toBe("R$ 0,00");
  expect(formatIngredientCost(summarizeIngredientCosts([cost, cost], 1).total)).toBe("R$ 0,01");
  expect(calculateIngredientCost(1, "g", material)).toBeNull();
  expect(calculateIngredientCost("", "L", material)).toBeNull();
  expect(calculateIngredientCost(1, "L", { ...material, unitCost: "0" })?.isZero()).toBe(true);
  expect(summarizeIngredientCosts([cost, null], 1).total).toBeNull();
  expect(summarizeIngredientCosts([cost], 0).perUnit).toBeNull();
});
