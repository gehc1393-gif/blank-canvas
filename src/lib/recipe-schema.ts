import { z } from "zod";
export const presentationSizeSchema = z.number().int().positive().max(2147483647);

export const recipeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((code) => code.toUpperCase()),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(3000),
  yield_units: z.number().int().positive().max(2147483647),
  unit_weight_grams: z.number().finite().positive().nullable(),
  prep_minutes: z.number().int().nonnegative().max(2147483647).nullable(),
  oven_minutes: z.number().int().nonnegative().max(2147483647).nullable(),
  oven_temperature_c: z.number().finite().positive().nullable(),
  instructions: z.string().trim().max(12000),
  notes: z.string().trim().max(3000),
  active: z.boolean(),
});

export const recipeIngredientsSchema = z
  .array(
    z.object({
      material_id: z.string().min(1).max(100),
      quantity: z.number().finite().positive(),
      unit: z.string().min(1).max(80),
    }),
  )
  .max(200)
  .refine((items) => new Set(items.map((item) => item.material_id)).size === items.length, {
    message: "Cada ingrediente pode aparecer apenas uma vez na ficha.",
  });

export type RecipeIngredient = z.infer<typeof recipeIngredientsSchema>[number];
export type RecipeMaterial = { id: string; name: string; unit: string; unitCost: string };
export const recipeSnapshotSchema = recipeSchema.extend({ ingredients: recipeIngredientsSchema });
export type Recipe = z.infer<typeof recipeSnapshotSchema> & {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
};

export const recipeVersionSchema = z.object({
  version: z.number().int().positive(),
  changed_at: z.string().datetime({ offset: true }),
  changed_by: z.string().uuid().nullable(),
  action: z.enum(["baseline", "created", "edited", "deactivated", "reactivated"]),
  snapshot: recipeSnapshotSchema,
});
export type RecipeVersion = z.infer<typeof recipeVersionSchema>;

const metricUnits = [
  { base: "g", larger: "kg" },
  { base: "ml", larger: "L" },
] as const;

export function compatibleUnits(unit: string): readonly string[] {
  const pair = metricUnits.find(({ base, larger }) => unit === base || unit === larger);
  return pair ? [pair.base, pair.larger] : [unit];
}

export function ingredientUnitShift(from: string, to: string) {
  if (!compatibleUnits(from).includes(to)) return undefined;
  if (from === to) return 0;
  return from === "kg" || from === "L" ? 3 : -3;
}

export function convertIngredientQuantity(quantity: number, from: string, to: string) {
  const shift = ingredientUnitShift(from, to);
  if (shift === undefined || shift === 0) return shift === 0 ? quantity : undefined;
  // Shift the decimal exponent so switching units does not add binary rounding artifacts.
  const [coefficient, exponent] = quantity.toExponential().split("e");
  const converted = Number(`${coefficient}e${Number(exponent) + shift}`);
  return Number.isFinite(converted) && converted > 0 ? converted : undefined;
}
