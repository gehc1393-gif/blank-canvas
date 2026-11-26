import Decimal from "decimal.js";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIngredientCost } from "@/lib/recipe-cost";
import { packagingCost } from "@/lib/packaging-schema";
import { listPackaging } from "@/lib/packaging.functions";
import { readComposition, saveComposition } from "@/lib/product-packaging.functions";

export function ProductPackaging({
  product,
  userId,
  ingredients,
  price,
}: {
  product: string;
  userId: string;
  ingredients: Decimal | null;
  price: number | undefined;
}) {
  const read = useServerFn(readComposition),
    save = useServerFn(saveComposition),
    list = useServerFn(listPackaging);
  const client = useQueryClient(),
    key = ["product-packaging", userId, product];
  const links = useQuery({ queryKey: key, queryFn: () => read({ data: product }) });
  const catalog = useQuery({
    queryKey: ["packaging", userId],
    queryFn: () => list(),
    refetchOnMount: "always",
  });
  const [draft, setDraft] = useState<{ id: string; quantity: string }[] | null>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [expected, setExpected] = useState<typeof links.data>();
  if (links.isError || catalog.isError)
    return <p role="alert">Falha ao carregar a composição de embalagens.</p>;
  if (!links.data || !catalog.data) return <p>Carregando composição…</p>;
  const chosen = draft ?? links.data.map((row) => ({ ...row, quantity: String(row.quantity) }));
  const rows = chosen.map((row) => {
    const packaging = catalog.data.rows.find((item) => item.id === row.id);
    const cost = packaging
      ? packagingCost(packaging.purchase_price, packaging.purchase_quantity, Number(row.quantity))
      : null;
    return { ...row, packaging, cost };
  });
  const total =
    rows.length && rows.every((row) => row.cost !== null)
      ? rows.reduce((sum, row) => sum.plus(row.cost!), new Decimal(0))
      : null;
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!draft || !expected || busy) return;
        setBusy(true);
        setMessage("");
        try {
          await save({
            data: {
              product,
              expected,
              items: draft.map((row) => ({ ...row, quantity: Number(row.quantity) })),
            },
          });
          await client.invalidateQueries({ queryKey: key });
          setDraft(null);
          setMessage("Composição salva.");
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Falha ao gravar a composição.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="space-y-3">
        {!rows.length && <p>Sem embalagem configurada.</p>}
        {rows.map(({ id, quantity, packaging, cost }, index) => (
          <div key={index} className="space-y-1 rounded border p-2">
            {draft ? (
              <select
                aria-label="Embalagem"
                className="w-full rounded border p-2"
                required
                value={id}
                onChange={(e) =>
                  setDraft(
                    draft.map((item, i) =>
                      i === index ? { id: e.target.value, quantity: "1" } : item,
                    ),
                  )
                }
              >
                <option value="">Selecione</option>
                {catalog.data.rows
                  .filter((p) => p.id === id || (p.active && !chosen.some((c) => c.id === p.id)))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
              </select>
            ) : (
              <strong>
                {packaging?.code} · {packaging?.name}
              </strong>
            )}
            {draft ? (
              <label>
                Quantidade{" "}
                <Input
                  type="number"
                  required
                  min={packaging?.use_unit === "unidade" ? 1 : 0.0001}
                  step={packaging?.use_unit === "unidade" ? 1 : 0.0001}
                  value={quantity}
                  onChange={(e) =>
                    setDraft(
                      draft.map((item, i) =>
                        i === index ? { ...item, quantity: e.target.value } : item,
                      ),
                    )
                  }
                />
              </label>
            ) : (
              <p>
                Quantidade: {quantity} {packaging?.use_unit}
              </p>
            )}
            {packaging && (
              <p>
                Unidade: {packaging.use_unit} · Saldo: {packaging.stock_balance} ·{" "}
                {packaging.stock_balance >= Number(quantity)
                  ? "Disponível"
                  : "Estoque insuficiente"}
                {!packaging.active && " · Inativa"}
              </p>
            )}
            <p>
              Custo unitário:{" "}
              {packaging && packaging.purchase_price > 0
                ? formatIngredientCost(
                    packagingCost(packaging.purchase_price, packaging.purchase_quantity),
                  )
                : "Não informado"}{" "}
              · Proporcional: {formatIngredientCost(cost)}
            </p>
            {draft && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setDraft(draft.filter((_, i) => i !== index))}
              >
                Remover item
              </Button>
            )}
          </div>
        ))}
        <p>Ingredientes: {formatIngredientCost(ingredients)}</p>
        <p>Embalagens: {formatIngredientCost(total)}</p>
        {!!rows.length && !total && <p>Custo de embalagem pendente.</p>}
        <p>
          Ingredientes + embalagens:{" "}
          {formatIngredientCost(ingredients && total ? ingredients.plus(total) : null)}
        </p>
        <p>
          Preço de venda atual:{" "}
          {price === undefined ? "Não cadastrado" : formatIngredientCost(String(price))}
        </p>
        {draft ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDraft([...draft, { id: "", quantity: "1" }])}
            >
              Adicionar embalagem
            </Button>
            <Button>Salvar composição</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(null);
                setMessage("");
              }}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setExpected(links.data);
              setDraft(chosen);
              setMessage("");
            }}
          >
            Editar composição
          </Button>
        )}
      </fieldset>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
