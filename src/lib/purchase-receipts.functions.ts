import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
const uuid = z.string().uuid();
const request = z.object({
  order: uuid,
  operation: uuid,
  revision: z.number().int(),
  date: z.string().date(),
  invoice: z.string().max(100),
  notes: z.string().max(4000),
  items: z
    .array(z.object({ line_id: uuid, qty: z.number().positive() }))
    .min(1)
    .max(200),
});
export type ReceiptRequest = z.infer<typeof request>;
export type Receipt = {
  id: string;
  number: number;
  received_on: string;
  received_by: string;
  invoice: string;
  notes: string;
  items: { line_id: string; qty: number; name: string; unit: string; movement_id: string }[];
};
export const receiptsForOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) => uuid.parse(v))
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const receipts: Receipt[] = [];
    for (let offset = 0; ; offset += 200) {
      const r = await db
        .from("purchase_receipts")
        .select("id,number,received_on,received_by,invoice,notes,items")
        .eq("user_id", context.userId)
        .eq("order_id", data)
        .order("number", { ascending: false })
        .range(offset, offset + 199);
      if (r.error) throw new Error("Falha ao consultar recebimentos.");
      receipts.push(...(r.data as Receipt[]));
      if (r.data.length < 200) return receipts;
    }
  });
export const receivePurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) => request.parse(v))
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const r = await db.rpc("receive_purchase", { p: data });
    if (r.error)
      throw new Error(
        r.error.code === "P0001" ? r.error.message : "Falha ao confirmar recebimento.",
      );
  });
