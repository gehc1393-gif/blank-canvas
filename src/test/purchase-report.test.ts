import { expect, it } from "vitest";
import type { Order } from "@/lib/purchase.functions";
import {
  expectedReceipt,
  receivable,
  purchaseSummary,
  receivedProgress,
} from "@/lib/purchase-report";

it.each([
  [1.1111, 1.1111, "kg", "kg", "1.23454321", false],
  [3, 5, "kg", "kg", "15", true],
  [3, 5000, "g", "kg", "15", true],
  [1, 0.01, "g", "kg", "0.00001", false],
  [2, 500, "ml", "L", "1", true],
  [1, 0.01, "ml", "L", "0.00001", false],
  [1, 1.5, "unidade", "unidade", "1.5", false],
] as const)("confere %s × %s em %s para %s", (qty, content, from, to, expected, valid) => {
  const result = expectedReceipt(qty, content, from, to)!;
  expect(result.toString()).toBe(expected);
  expect(receivable(result, to)).toBe(valid);
});
it("mostra progresso parcial e completo sem arredondar o saldo", () => {
  expect(receivedProgress(15, [10]).percent).toBe("66,67");
  expect(receivedProgress(15, [10]).pending.toString()).toBe("5");
  expect(receivedProgress(15, [10, 5]).percent).toBe("100,00");
  expect(receivedProgress(15, [10, 5]).pending.toString()).toBe("0");
});
it("contabiliza cada pedido uma vez e só marca atraso quando há prazo e saldo pendente", () => {
  const row = (status: string, total: number, delivery_on: string | null) =>
    ({ status, total, delivery_on }) as Order;
  const summary = purchaseSummary(
    [
      row("emitido", 210, null),
      row("parcialmente recebido", 50, "2026-11-20"),
      row("recebido", 100, "2026-11-20"),
      row("cancelado", 80, "2026-11-20"),
    ],
    "2026-11-25",
  );
  expect(summary.late).toBe(1);
  expect(summary.issued.toString()).toBe("360");
  expect(summary.pending.toString()).toBe("260");
  expect(summary.completed.toString()).toBe("100");
  expect(summary.cancelled.toString()).toBe("80");
});
