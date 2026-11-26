import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
const item = z.object({
  id: z.string().min(1),
  kind: z.enum(["ingrediente", "embalagem"]),
  buy_unit: z.string(),
  content_unit: z.string(),
  qty: z.number(),
  content: z.number(),
  price: z.number(),
});
const request = z.object({
  id: z.string().uuid(),
  operation: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  action: z.enum(["salvar", "emitir", "cancelar"]),
  supplier: z.string(),
  date: z.string(),
  delivery: z.string(),
  notes: z.string().max(4000),
  discount: z.number(),
  freight: z.number(),
  reason: z.string().optional(),
  items: z.array(item).max(200),
});
export type PurchaseRequest = z.infer<typeof request>;
export type Order = {
  id: string;
  number: number;
  supplier_id: string;
  supplier_name: string;
  ordered_on: string;
  delivery_on: string | null;
  notes: string;
  discount: number;
  freight: number;
  subtotal: number;
  total: number;
  revision: number;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  issued_at: string | null;
  issued_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  items: (z.infer<typeof item> & {
    name: string;
    code: string;
    stock_unit: string;
    receipt: number;
    total: number;
  })[];
};
export const purchaseList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: SupabaseClient = context.supabase;
    const rows: Order[] = [];
    for (let offset = 0; ; offset += 200) {
      const result = await db
        .from("purchase_orders")
        .select("*")
        .eq("user_id", context.userId)
        .order("number", { ascending: false })
        .range(offset, offset + 199);
      if (result.error) throw new Error("Falha ao consultar pedidos.");
      rows.push(...(result.data as Order[]));
      if (result.data.length < 200) return rows;
    }
  });
export const changePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => request.parse(value))
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const { error } = await db.rpc("change_purchase_order", { p: data });
    if (error)
      throw new Error(
        error.code === "P0001" ? error.message : "Falha ao gravar pedido. Confira os dados.",
      );
  });
export const purchaseQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) =>
    z.object({ supplier: z.string().uuid(), material: z.string() }).parse(value),
  )
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const result = await db
      .from("supplier_quotes")
      .select("package_price,package_quantity,unit,quoted_on")
      .eq("user_id", context.userId)
      .eq("supplier_id", data.supplier)
      .eq("material_id", data.material)
      .order("quoted_on", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw new Error("Falha ao consultar cotação.");
    return result.data as {
      package_price: number;
      package_quantity: number;
      unit: string;
      quoted_on: string;
    } | null;
  });
