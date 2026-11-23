import Decimal from "decimal.js";
import { z } from "zod";

export const useUnits = ["unidade", "m", "kg", "m²"] as const;
export const dimensionUnits = ["mm", "cm", "m"] as const;
const decimal = (places: number, digits: number) =>
  z
    .number()
    .finite()
    .nonnegative()
    .refine(
      (n) => new Decimal(n).decimalPlaces() <= places && n < 10 ** digits,
      "Valor fora da precisão permitida.",
    );
const positive = decimal(4, 8).refine((n) => n > 0, "Informe uma quantidade maior que zero.");
export const packagingSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(48)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1).max(160),
  category: z.string().min(1),
  description: z.string().max(3000),
  material: z.string().max(160),
  photo: z
    .string()
    .max(350000)
    .regex(/^(?:data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+)?$/),
  width: positive.nullable(),
  height: positive.nullable(),
  depth: positive.nullable(),
  dimension_unit: z.enum(dimensionUnits),
  use_unit: z.enum(useUnits),
  purchase_quantity: positive,
  purchase_price: decimal(2, 10),
  minimum: decimal(4, 8),
  notes: z.string().max(3000),
  active: z.boolean(),
});
export type Packaging = z.infer<typeof packagingSchema>;
export type PackagingRow = Packaging & {
  stock_balance: number;
  last_stock_at: string | null;
  id: string;
  created_at: string;
  updated_at: string;
};
export const emptyPackaging: Packaging = {
  code: "",
  name: "",
  category: "",
  description: "",
  material: "",
  photo: "",
  width: null,
  height: null,
  depth: null,
  dimension_unit: "cm",
  use_unit: "unidade",
  purchase_quantity: 1,
  purchase_price: 0,
  minimum: 0,
  notes: "",
  active: true,
};
export function packagingCost(price: number, purchased: number, used = 1) {
  return price > 0 && purchased > 0 ? new Decimal(price).times(used).div(purchased) : null;
}
