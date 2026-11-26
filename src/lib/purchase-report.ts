import Decimal from "decimal.js";
import { ingredientUnitShift } from "./recipe-schema";
import type { Order } from "./purchase.functions";

export const purchaseStatuses = [
  "rascunho",
  "emitido",
  "parcialmente recebido",
  "recebido",
  "cancelado",
] as const;
export const purchaseToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function expectedReceipt(quantity: number, content: number, from: string, to: string) {
  const shift = ingredientUnitShift(from, to);
  return shift === undefined
    ? null
    : new Decimal(quantity).times(content).times(new Decimal(10).pow(shift));
}
export function receivable(value: Decimal, unit: string) {
  return (
    value.gt(0) &&
    value.lte("99999999999.9999") &&
    value.decimalPlaces() <= 4 &&
    (!["unidade", "pacote"].includes(unit) || value.isInteger())
  );
}
export const pendingOrder = (o: Order) =>
  o.status === "emitido" || o.status === "parcialmente recebido";
export const lateOrder = (o: Order, today: string) =>
  pendingOrder(o) && !!o.delivery_on && o.delivery_on < today;
export function purchaseSummary(rows: Order[], today: string) {
  const amount = (predicate: (o: Order) => boolean) =>
    rows.filter(predicate).reduce((sum, o) => sum.plus(o.total), new Decimal(0));
  const count = (status: string) => rows.filter((o) => o.status === status).length;
  return {
    count,
    late: rows.filter((o) => lateOrder(o, today)).length,
    issued: amount((o) => pendingOrder(o) || o.status === "recebido"),
    cancelled: amount((o) => o.status === "cancelado"),
    pending: amount(pendingOrder),
    completed: amount((o) => o.status === "recebido"),
  };
}
export function receivedProgress(requested: number, quantities: number[]) {
  const received = quantities.reduce((sum, qty) => sum.plus(qty), new Decimal(0));
  const pending = new Decimal(requested).minus(received);
  return {
    received,
    pending,
    percent:
      requested > 0 ? received.times(100).div(requested).toFixed(2).replace(".", ",") : "0,00",
  };
}
