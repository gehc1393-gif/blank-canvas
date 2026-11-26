import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const product = z.string().min(1);
const items = z.array(
  z.object({ id: z.string().uuid(), quantity: z.number().finite().positive() }),
);
export const readComposition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => product.parse(value))
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const result = await db.rpc("read_product_packaging", { p_product: data });
    if (result.error) throw new Error("Falha ao consultar a composição.");
    return items.parse(result.data);
  });
export const saveComposition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((value: unknown) => z.object({ product, expected: items, items }).parse(value))
  .handler(async ({ context, data }) => {
    const db: SupabaseClient = context.supabase;
    const result = await db.rpc("save_product_packaging", {
      p_product: data.product,
      p_expected: data.expected,
      p_items: data.items,
    });
    if (result.error)
      throw new Error(
        result.error.code === "P0001"
          ? result.error.message
          : result.error.code === "23505"
            ? "Embalagem repetida."
            : "Falha ao gravar a composição.",
      );
  });
