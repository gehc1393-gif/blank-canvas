import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recipeSchema, type Recipe } from "./recipe-schema";

export const listRecipes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const recipes: Recipe[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await context.supabase
        .from("recipe_sheets")
        .select(
          "id,code,name,category,description,yield_units,unit_weight_grams,prep_minutes,oven_minutes,oven_temperature_c,instructions,notes,active",
        )
        .eq("user_id", context.userId)
        .order("name")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error("Não foi possível carregar as receitas.");
      recipes.push(...data);
      if (data.length < pageSize) return recipes;
    }
  });

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), fields: recipeSchema }),
  z.object({ action: z.literal("edit"), id: z.string().uuid(), fields: recipeSchema }),
  z.object({ action: z.literal("deactivate"), id: z.string().uuid() }),
]);

export type RecipeAction = z.infer<typeof actionSchema>;

export const changeRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => actionSchema.parse(input))
  .handler(async ({ context, data }) => {
    const table = context.supabase.from("recipe_sheets");
    const result = await (
      data.action === "create"
        ? table.insert({ ...data.fields, user_id: context.userId })
        : table
            .update(data.action === "edit" ? data.fields : { active: false })
            .eq("id", data.id)
            .eq("user_id", context.userId)
    )
      .select("id")
      .maybeSingle();
    if (result.error?.code === "23505") {
      return { ok: false as const, message: "Já existe uma receita com este código." };
    }
    if (result.error || !result.data) {
      return {
        ok: false as const,
        message: "Não foi possível salvar a receita. Confira a conexão e tente novamente.",
      };
    }
    return { ok: true as const };
  });
