import { expect, it } from "vitest";
import {
  calculateIngredientCost,
  calculatePresentationCost,
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

it("recalculates the exact unit and package costs when flour changes from 500 g to 600 g", () => {
  const materials = new Map([
    ["flour", { id: "flour", name: "Farinha", unit: "kg", unitCost: "8" }],
    ["butter", { id: "butter", name: "Manteiga", unit: "kg", unitCost: "44" }],
    ["sugar", { id: "sugar", name: "Açúcar", unit: "kg", unitCost: "8" }],
  ]);
  for (const [flour, total, unit, pack] of [
    [500, "16.76", "0.838", "8.38"],
    [600, "17.56", "0.878", "8.78"],
  ] as const) {
    const result = calculatePresentationCost(
      {
        yield_units: 20,
        ingredients: [
          { material_id: "flour", quantity: flour, unit: "g" },
          { material_id: "butter", quantity: 250, unit: "g" },
          { material_id: "sugar", quantity: 220, unit: "g" },
        ],
      },
      materials,
      10,
    );
    expect(result.total?.toString()).toBe(total);
    expect(result.perUnit?.toString()).toBe(unit);
    expect(result.perPresentation?.toString()).toBe(pack);
  }
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
  expect(calculatePresentationCost({ yield_units: 20, ingredients: [] }, new Map(), 10)).toEqual({
    total: null,
    perUnit: null,
    perPresentation: null,
  });
});
