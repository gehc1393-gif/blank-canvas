import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { packagingSchema, type PackagingRow, type Packaging } from "./packaging-schema";

type CatalogDB = {
  public: {
    Tables: {
      packaging: {
        Row: PackagingRow & { user_id: string };
        Insert: Packaging;
        Update: Partial<Packaging>;
        Relationships: [];
      };
      packaging_categories: {
        Row: { name: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
};

const catalog = (client: unknown) => client as SupabaseClient<CatalogDB>;
export const listPackaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = catalog(context.supabase);
    const categories = await db.from("packaging_categories").select("name").order("name");
    if (categories.error) throw new Error("Falha ao carregar categorias.");
    const rows: Pick<
      PackagingRow,
      | "id"
      | "name"
      | "code"
      | "category"
      | "active"
      | "purchase_price"
      | "purchase_quantity"
      | "use_unit"
      | "updated_at"
    >[] = [];
    for (let offset = 0; ; offset += 500) {
      const page = await db
        .from("packaging")
        .select("id,name,code,category,active,purchase_price,purchase_quantity,use_unit,updated_at")
        .eq("user_id", context.userId)
        .order("code")
        .range(offset, offset + 499);
      if (page.error) throw new Error("Falha ao carregar embalagens.");
      rows.push(...page.data);
      if (page.data.length < 500) return { rows, categories: categories.data.map((c) => c.name) };
    }
  });
export const readPackaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) => z.string().uuid().parse(v))
  .handler(async ({ context, data }) => {
    const result = await catalog(context.supabase)
      .from("packaging")
      .select("*")
      .eq("id", data)
      .eq("user_id", context.userId)
      .single();
    if (result.error) throw new Error("Não foi possível abrir a embalagem.");
    return result.data;
  });
const existing = z.object({
  id: z.string().uuid(),
  updated_at: z.string().datetime({ offset: true }),
});
const change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), values: packagingSchema }),
  existing.extend({ action: z.literal("edit"), values: packagingSchema }),
  existing.extend({ action: z.literal("status"), active: z.boolean() }),
]);
export const savePackaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((v: unknown) => change.parse(v))
  .handler(async ({ context, data }) => {
    const table = catalog(context.supabase).from("packaging");
    const query =
      data.action === "create"
        ? table.insert(data.values)
        : table
            .update(data.action === "edit" ? data.values : { active: data.active })
            .eq("user_id", context.userId)
            .eq("id", data.id)
            .eq("updated_at", data.updated_at);
    const result = await query.select("id").maybeSingle();
    if (result.error?.code === "23505") throw new Error("Código já cadastrado nesta conta.");
    if (result.error) throw new Error("Falha ao salvar a embalagem.");
    if (!result.data) throw new Error("Registro alterado em outra sessão. Reabra a embalagem.");
  });
