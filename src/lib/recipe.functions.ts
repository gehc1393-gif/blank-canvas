import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  compatibleUnits,
  convertIngredientQuantity,
  recipeSnapshotSchema,
  recipeVersionSchema,
  type Recipe,
  type RecipeMaterial,
} from "./recipe-schema";

export const listRecipes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const recipes: Recipe[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await context.supabase
        .from("recipe_sheets")
        .select("*")
        .eq("user_id", context.userId)
        .order("name")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error("Não foi possível carregar as receitas.");
      for (const item of data) {
        recipes.push({
          ...recipeSnapshotSchema.parse(item),
          id: item.id,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
          updatedBy: item.updated_by,
        });
      }
      if (data.length < pageSize) return recipes;
    }
  });

export const listRecipeMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const materials: RecipeMaterial[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await context.supabase
        .from("materials")
        .select("id,name,unit,unitCost::text")
        .eq("user_id", context.userId)
        .order("name")
        .order("id")
        .range(offset, offset + pageSize - 1);
      if (error) throw new Error("Não foi possível carregar os ingredientes do estoque.");
      materials.push(...data);
      if (data.length < pageSize) return materials;
    }
  });

export const listRecipeVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), before: z.number().int().positive().optional() })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("recipe_sheet_versions")
      .select("version,changed_at,changed_by,action,snapshot")
      .eq("user_id", context.userId)
      .eq("recipe_sheet_id", data.id);
    if (data.before !== undefined) query = query.lt("version", data.before);
    const result = await query.order("version", { ascending: false }).limit(26);
    if (result.error) throw new Error("Não foi possível carregar o histórico.");
    const versions = z.array(recipeVersionSchema).parse(result.data);
    return {
      versions: versions.slice(0, 25),
      next: versions.length > 25 ? (versions[24]?.version ?? null) : null,
    };
  });

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), fields: recipeSnapshotSchema }),
  z.object({ action: z.literal("edit"), id: z.string().uuid(), fields: recipeSnapshotSchema }),
  z.object({ action: z.literal("deactivate"), id: z.string().uuid() }),
]);

export type RecipeAction = z.infer<typeof actionSchema>;

export const changeRecipe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => actionSchema.parse(input))
  .handler(async ({ context, data }) => {
    if (data.action !== "deactivate" && data.fields.ingredients.length > 0) {
      const { data: materials, error } = await context.supabase
        .from("materials")
        .select("id,unit")
        .eq("user_id", context.userId)
        .in(
          "id",
          data.fields.ingredients.map((item) => item.material_id),
        );
      if (error)
        return {
          ok: false as const,
          message: "Não foi possível conferir os ingredientes no estoque.",
        };
      const unitsById = new Map(materials.map((item) => [item.id, item.unit]));
      for (const item of data.fields.ingredients) {
        const unit = unitsById.get(item.material_id);
        if (
          !unit ||
          !compatibleUnits(unit).includes(item.unit) ||
          convertIngredientQuantity(item.quantity, item.unit, unit) === undefined
        ) {
          return {
            ok: false as const,
            message: "Confira a disponibilidade e a unidade de cada ingrediente no estoque.",
          };
        }
      }
    }
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
