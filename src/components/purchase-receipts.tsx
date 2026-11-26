import { receivedProgress } from "@/lib/purchase-report";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Order } from "@/lib/purchase.functions";
import {
  receiptsForOrder,
  receivePurchase,
  type ReceiptRequest,
} from "@/lib/purchase-receipts.functions";

export function PurchaseReceipts({
  order,
  userId,
  onReload,
}: {
  order: Order;
  userId: string;
  onReload: () => Promise<void>;
}) {
  const client = useQueryClient(),
    key = ["purchase-receipts", userId, order.id];
  const load = useServerFn(receiptsForOrder),
    save = useServerFn(receivePurchase);
  const history = useQuery({ queryKey: key, queryFn: () => load({ data: order.id }) });
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const attempt = useRef<{ signature: string; id: string }>({ signature: "", id: "" });
  const allowed = ["emitido", "parcialmente recebido"].includes(order.status);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  const lines = order.items.map((item) => {
    return {
      ...item,
      ...receivedProgress(
        item.receipt,
        (history.data ?? [])
          .flatMap((r) => r.items)
          .filter((line) => line.line_id === item.line_id)
          .map((line) => line.qty),
      ),
    };
  });
  return (
    <section className="space-y-3 border-t pt-3">
      {allowed && history.isSuccess && !open && (
        <Button
          type="button"
          onClick={() => {
            setOpen(true);
            setMessage("");
          }}
        >
          Registrar Recebimento
        </Button>
      )}
      {message && <p role="status">{message}</p>}
      {history.isSuccess && (
        <>
          <p>
            Último recebimento:{" "}
            {history.data
              .map((r) => r.received_on)
              .sort()
              .at(-1) ?? "—"}
          </p>
          <ul>
            {lines.map((line) => (
              <li key={line.line_id} className="break-words">
                {line.name} · Solicitado {line.receipt} · Recebido {line.received.toString()} ·
                Pendente {line.pending.toString()} {line.stock_unit} · {line.percent}%
              </li>
            ))}
          </ul>
        </>
      )}
      {open && allowed && (
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const form = new FormData(e.currentTarget);
            const items = lines
              .filter((line) => Number(form.get(line.line_id)) > 0)
              .map((line) => ({ line_id: line.line_id, qty: Number(form.get(line.line_id)) }));
            if (!items.length) {
              setMessage("Informe pelo menos uma quantidade.");
              return;
            }
            const data = {
              order: order.id,
              revision: order.revision,
              date: String(form.get("date")),
              invoice: String(form.get("invoice")),
              notes: String(form.get("notes")),
              items,
            };
            const signature = JSON.stringify(data);
            if (signature !== attempt.current.signature)
              attempt.current = { signature, id: crypto.randomUUID() };
            const request: ReceiptRequest = { ...data, operation: attempt.current.id };
            setBusy(true);
            setMessage("");
            try {
              await save({ data: request });
              setOpen(false);
              setMessage("Recebimento confirmado.");
              await Promise.all([
                onReload(),
                client.invalidateQueries({ queryKey: key }),
                client.invalidateQueries({ queryKey: ["packaging", userId] }),
                client.invalidateQueries({ queryKey: ["pack-history", userId] }),
                client.invalidateQueries({ queryKey: ["pack-count", userId] }),
              ]);
            } catch (err) {
              setMessage(err instanceof Error ? err.message : "Falha ao confirmar recebimento.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-3">
            <p>
              Pedido #{order.number} · {order.supplier_name} · Responsável: usuário conectado. O
              número do recebimento é gerado na confirmação.
            </p>
            <label>
              Data do recebimento
              <Input type="date" name="date" defaultValue={today} max={today} required />
            </label>
            <label>
              Nota fiscal (opcional)
              <Input name="invoice" maxLength={100} />
            </label>
            <label>
              Observações
              <Input name="notes" maxLength={4000} />
            </label>
            {lines.map((line) => (
              <label key={line.line_id} className="block">
                {line.name} · Solicitado {line.receipt} · Recebido {line.received.toString()} ·
                Pendente {line.pending.toString()} {line.stock_unit}
                <Input
                  aria-label={`Quantidade recebida de ${line.name}`}
                  name={line.line_id}
                  type="number"
                  min="0"
                  step={["unidade", "pacote"].includes(line.stock_unit) ? 1 : 0.0001}
                  max={line.pending.toString()}
                  disabled={line.pending.lte(0)}
                />
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button>Confirmar recebimento</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Voltar
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      <h4 className="font-semibold">Histórico de Recebimentos</h4>
      {history.isPending && <p>Carregando recebimentos…</p>}
      {history.isError && <p role="alert">Falha ao consultar recebimentos.</p>}
      {history.data?.length === 0 && <p>Nenhum recebimento registrado.</p>}
      {history.data?.map((r) => (
        <article key={r.id} className="space-y-1 break-words rounded border p-3">
          <strong>Recebimento #{r.number} · Confirmado</strong>
          <p>
            Pedido #{order.number} · {order.supplier_name} · {r.received_on}
          </p>
          <p>
            Responsável: {r.received_by === userId ? "Você" : r.received_by}
            {r.invoice && " · Nota fiscal " + r.invoice}
          </p>
          <p>{r.notes}</p>
          <ul>
            {r.items.map((i) => (
              <li key={i.line_id}>
                {i.name} · {i.qty} {i.unit} · Movimento {i.movement_id}
              </li>
            ))}
          </ul>
          <p>Operação {r.id}</p>
        </article>
      ))}
    </section>
  );
}
