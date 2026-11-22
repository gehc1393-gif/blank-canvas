import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supplierSchema, type Supplier, type SupplierDraft } from "./supplier-schema";

type Row = Supplier & { user_id: string };
type SupplierDatabase = { public: { Tables: { suppliers: {
  Row: Row; Insert: SupplierDraft & { user_id: string }; Update: Partial<SupplierDraft>; Relationships: [];
} }; Views: {}; Functions: {} } };

export const listSuppliers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as SupabaseClient<SupplierDatabase>;
    const suppliers: Supplier[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await db.from("suppliers").select("*").eq("user_id", context.userId)
        .order("code").range(offset, offset + 499);
      if (error) throw new Error("Falha ao consultar fornecedores.");
      suppliers.push(...data);
      if (data.length < 500) return suppliers;
    }
  });

const change = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), values: supplierSchema }),
  z.object({ action: z.literal("edit"), id: z.string().uuid(), updated_at: z.string(), values: supplierSchema }),
  z.object({ action: z.literal("status"), id: z.string().uuid(), updated_at: z.string(), active: z.boolean() }),
]);
export const saveSupplier = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .validator((input: unknown) => change.parse(input)).handler(async ({ context, data }) => {
    const db = context.supabase as unknown as SupabaseClient<SupplierDatabase>;
    const table = db.from("suppliers");
    const query = data.action === "create" ? table.insert({ ...data.values, user_id: context.userId }) :
      table.update(data.action === "edit" ? data.values : { active: data.active })
        .eq("id", data.id).eq("user_id", context.userId).eq("updated_at", data.updated_at);
    const result = await query.select("id").maybeSingle();
    if (result.error?.code === "23505") throw new Error("CPF/CNPJ já cadastrado nesta conta.");
    if (result.error) throw new Error("Falha ao salvar fornecedor.");
    if (!result.data) throw new Error("O cadastro mudou. Atualize a listagem antes de tentar novamente.");
  });
