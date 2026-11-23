import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const quote = z.object({
  price: z.number(), quantity: z.number(), equivalent: z.number(), unit: z.string(),
  date: z.string(), recorded: z.string(), author: z.string(),
});
const links = z.array(z.object({
  supplier_id: z.string(), name: z.string(), active: z.boolean(), notes: z.string(),
  linked: z.boolean(), is_primary: z.boolean(), history: z.array(quote),
}));
const materialId = z.string().min(1);
export const readMaterialSuppliers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((v: unknown) => materialId.parse(v)).handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const result = await db.rpc("material_supplier_details", { p_material: data });
    if (result.error) throw new Error("Falha ao consultar as cotações.");
    return links.parse(result.data);
  });
const base = z.object({ p_material: materialId, p_supplier: z.string().uuid() });
const change = z.discriminatedUnion("p_action", [
  base.extend({ p_action: z.literal("link") }),
  base.extend({ p_action: z.literal("unlink") }),
  base.extend({ p_action: z.literal("primary") }),
  base.extend({ p_action: z.literal("notes"), p_notes: z.string().max(3000) }),
  base.extend({ p_action: z.literal("quote"), p_price: z.number().finite().positive(),
    p_quantity: z.number().finite().positive(), p_unit: z.string().min(1), p_date: z.string().date() }),
]);
export type SupplierChange = z.infer<typeof change>;
export const writeMaterialSupplier = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((v: unknown) => change.parse(v)).handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const result = await db.rpc("save_material_supplier", data);
    if (result.error) throw new Error(result.error.code === "23505" ? "Fornecedor já vinculado." : "Falha ao salvar. Confira os dados e a data da cotação.");
  });
