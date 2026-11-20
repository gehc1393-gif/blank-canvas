import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRecipeMaterials, listRecipes } from "./recipe.functions";

export function useLinkedRecipes(userId: string, enabled = true) {
  const list = useServerFn(listRecipes);
  const listMaterials = useServerFn(listRecipeMaterials);
  const recipes = useQuery({
    queryKey: ["recipe-sheets", userId],
    queryFn: () => list(),
    enabled,
    retry: false,
  });
  const materials = useQuery({
    queryKey: ["recipe-materials", userId],
    queryFn: () => listMaterials(),
    enabled,
    retry: false,
  });
  return {
    recipes,
    materialsById: new Map(materials.data?.map((item) => [item.id, item])),
    unavailable: recipes.isError || materials.isError,
  };
}
