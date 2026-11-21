import { useInfiniteQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { listRecipeVersions } from "@/lib/recipe.functions";
import type { RecipeVersion } from "@/lib/recipe-schema";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function formatRecipeDate(date: string | undefined) {
  return date ? dateTime.format(new Date(date)) : "Não registrada";
}

export function recipeAuthor(id: string | null | undefined, userId: string) {
  return id === userId ? "Você" : (id ?? "Não registrado");
}

const actions: Record<RecipeVersion["action"], string> = {
  baseline: "Versão inicial do histórico",
  created: "Criação",
  edited: "Edição",
  deactivated: "Inativação",
  reactivated: "Reativação",
};

export function RecipeHistory({
  recipeId,
  userId,
  onSelect,
}: {
  recipeId: string;
  userId: string;
  onSelect: (version: RecipeVersion) => void;
}) {
  const list = useServerFn(listRecipeVersions);
  const history = useInfiniteQuery({
    queryKey: ["recipe-history", userId, recipeId],
    queryFn: ({ pageParam }) =>
      list({ data: { id: recipeId, ...(pageParam === null ? {} : { before: pageParam }) } }),
    initialPageParam: null as number | null,
    getNextPageParam: (page) => page.next,
    retry: false,
  });
  const versions = history.data?.pages.flatMap((page) => page.versions) ?? [];

  return (
    <section className="space-y-3 border-t pt-4" aria-label="Histórico de versões">
      <h3 className="text-sm font-semibold">Histórico de versões</h3>
      {history.isPending && (
        <p role="status" className="text-sm">
          Carregando versões…
        </p>
      )}
      {history.isError && (
        <div role="alert" className="flex items-center gap-2 text-sm">
          Não foi possível carregar o histórico.
          <Button type="button" variant="outline" size="sm" onClick={() => void history.refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {history.isSuccess && versions.length === 0 && (
        <p className="text-sm">Nenhuma versão registrada.</p>
      )}
      {versions.length > 0 && (
        <ol className="divide-y rounded-md border">
          {versions.map((version) => (
            <li
              key={version.version}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  Versão {version.version} · {actions[version.action]}
                </p>
                <p>
                  {formatRecipeDate(version.changed_at)} ·{" "}
                  {recipeAuthor(version.changed_by, userId)}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => onSelect(version)}>
                Ver versão {version.version}
              </Button>
            </li>
          ))}
        </ol>
      )}
      {history.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          disabled={history.isFetching}
          onClick={() => void history.fetchNextPage()}
        >
          {history.isFetchingNextPage ? "Carregando…" : "Carregar versões anteriores"}
        </Button>
      )}
    </section>
  );
}
