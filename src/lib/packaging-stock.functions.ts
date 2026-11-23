import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { useUnits } from "./packaging-schema";
const kinds = z.enum(["entrada", "saida", "perda", "ajuste"]);
const period = z.object({ from: z.string().date(), to: z.string().date() });
const movement = z.object({
  operation_id: z.string(),
  kind: kinds,
  quantity: z.number(),
  unit: z.enum(useUnits),
  previous_balance: z.number(),
  new_balance: z.number(),
  movement_date: z.string(),
  recorded_at: z.string(),
  reason: z.string(),
  notes: z.string(),
  responsible: z.string(),
});
export const countStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) => period.parse(v))
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const result = await db
      .from("packaging_stock_movements")
      .select("operation_id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("movement_date", data.from)
      .lte("movement_date", data.to);
    if (result.error) throw new Error("Falha ao consultar indicadores.");
    return result.count ?? 0;
  });
export const stockHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) =>
    z
      .object({
        item: z.string().uuid(),
        from: z.string().date().optional(),
        to: z.string().date().optional(),
        kind: kinds.optional(),
        page: z.number().int().nonnegative(),
      })
      .parse(v),
  )
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    let q = db
      .from("packaging_stock_movements")
      .select("*")
      .eq("user_id", context.userId)
      .eq("packaging_id", data.item);
    if (data.kind) q = q.eq("kind", data.kind);
    if (data.from) q = q.gte("movement_date", data.from);
    if (data.to) q = q.lte("movement_date", data.to);
    const { data: rows, error } = await q
      .order("recorded_at", { ascending: false })
      .order("operation_id")
      .range(data.page * 30, data.page * 30 + 30);
    if (error) throw new Error("Falha ao consultar o histórico.");
    return { rows: z.array(movement).parse(rows?.slice(0, 30)), more: (rows?.length ?? 0) > 30 };
  });
export const moveStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) =>
    z
      .object({
        p_item: z.string().uuid(),
        p_operation: z.string().uuid(),
        p_kind: kinds,
        p_quantity: z.number().finite().nonnegative(),
        p_unit: z.enum(useUnits),
        p_date: z.string().date(),
        p_reason: z.string().trim().min(1).max(300),
        p_notes: z.string().trim().max(2000),
        p_expected: z.number().nullable(),
      })
      .parse(v),
  )
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const { error } = await db.rpc("move_packaging_stock", data);
    if (error)
      throw new Error(
        error.code === "P0001" ? error.message : "Não foi possível registrar a movimentação.",
      );
  });
