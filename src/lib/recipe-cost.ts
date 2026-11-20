import Decimal from "decimal.js";
import { ingredientUnitShift, presentationSizeSchema, type RecipeMaterial } from "./recipe-schema";

// Keep enough significant digits to sum products across the finite numeric range of the app.
const Cost = Decimal.clone({ precision: 1400, rounding: Decimal.ROUND_HALF_UP });

export function calculatePresentationCost(
  recipe: {
    ingredients: { material_id: string; quantity: number; unit: string }[];
    yield_units: number;
  },
  materials: ReadonlyMap<string, RecipeMaterial>,
  presentationSize: number,
) {
  const { total, perUnit } = summarizeIngredientCosts(
    recipe.ingredients.map((item) =>
      calculateIngredientCost(item.quantity, item.unit, materials.get(item.material_id)),
    ),
    recipe.yield_units,
  );
  return {
    total,
    perUnit,
    perPresentation: presentationSizeSchema.safeParse(presentationSize).success
      ? (perUnit?.times(presentationSize) ?? null)
      : null,
  };
}

export function calculateIngredientCost(
  quantity: string | number,
  unit: string,
  material: RecipeMaterial | undefined,
) {
  if (!material || !String(quantity).trim()) return null;
  const shift = ingredientUnitShift(unit, material.unit);
  if (shift === undefined) return null;
  const amount = new Cost(quantity);
  const price = new Cost(material.unitCost);
  if (!amount.isFinite() || !amount.gt(0) || !price.isFinite() || price.lt(0)) return null;
  return amount.times(`1e${shift}`).times(price);
}

export function summarizeIngredientCosts(costs: (Decimal | null)[], yieldUnits: number) {
  let total = new Cost(0);
  for (const cost of costs) {
    if (cost === null) return { total: null, perUnit: null };
    total = total.plus(cost);
  }
  return {
    total,
    perUnit: Number.isInteger(yieldUnits) && yieldUnits > 0 ? total.div(yieldUnits) : null,
  };
}

export function formatIngredientCost(value: Decimal | string | null) {
  if (value === null) return "—";
  const decimal = new Cost(value);
  if (!decimal.isFinite() || decimal.lt(0)) return "—";
  const [whole, cents] = decimal.toFixed(2).split(".");
  return `R$ ${whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${cents}`;
}
