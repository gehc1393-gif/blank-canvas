import { z } from "zod";

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

export type RecipeFields = z.infer<typeof recipeSchema>;
export type Recipe = RecipeFields & { id: string };
