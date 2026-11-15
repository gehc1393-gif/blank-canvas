import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { businessSchema } from "./business-schema";

export const readBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("read_business_data");
    if (error) throw new Error("Não foi possível carregar seus registros.");
    return z.object({ revision: z.number().int(), data: businessSchema }).parse({ revision: data && typeof data === "object" && !Array.isArray(data) ? data["revision"] : undefined, data });
  });

export const saveBusiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ revision: z.number().int().nonnegative(), data: businessSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: revision, error } = await context.supabase.rpc("save_business_data", { expected_revision: data.revision, payload: data.data });
    if (error) return { ok: false as const, conflict: error.message.includes("STALE_REVISION") };
    return { ok: true as const, revision };
  });