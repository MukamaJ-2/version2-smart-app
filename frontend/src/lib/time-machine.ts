import { endOfMonth, isAfter, parseISO, subMonths } from "date-fns";
import type { TrainingTransaction } from "@/lib/ai/training-data";

/**
 * Signed month offset from the time machine: negative = past, 0 = now, positive = future preview.
 */

/** End of the calendar month that is `|months|` before today (only for past mode). */
export function getPastViewAsOfEnd(simulatedMonths: number): Date | null {
  if (simulatedMonths >= 0) return null;
  return endOfMonth(subMonths(new Date(), Math.abs(simulatedMonths)));
}

/** Transactions on or before the end of the "as of" month (inclusive). */
export function filterTransactionsThroughDate<T extends { date: string }>(
  transactions: T[],
  asOfEndInclusive: Date
): T[] {
  return transactions.filter((tx) => {
    const raw = tx.date?.trim();
    if (!raw) return false;
    const d = parseISO(raw.length <= 10 ? `${raw}T12:00:00` : raw);
    if (Number.isNaN(d.getTime())) return false;
    return !isAfter(d, asOfEndInclusive);
  });
}

/** Rough monthly income from income transactions spread over the observed date range (min ~1 month). */
export function estimateMonthlyIncomeFromTransactions(
  txs: Array<{ type: string; amount: number; date: string }>
): number {
  const incomes = txs.filter((t) => t.type === "income");
  if (incomes.length === 0) return 0;
  const total = incomes.reduce((s, t) => s + t.amount, 0);
  const times = incomes
    .map((t) => parseISO(t.date.length <= 10 ? `${t.date}T12:00:00` : t.date).getTime())
    .filter((n) => !Number.isNaN(n));
  if (times.length === 0) return total;
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const spanDays = Math.max(1, (maxT - minT) / (86400 * 1000));
  const spanMonths = Math.max(spanDays / 30, 1 / 30);
  return total / spanMonths;
}

export function toTrainingTransactions(
  txs: Array<{
    description?: string;
    amount: number;
    category?: string;
    type: string;
    date: string;
  }>
): TrainingTransaction[] {
  return txs.map((tx) => ({
    description: tx.description ?? "",
    amount: tx.amount,
    category: tx.category ?? "General",
    type: tx.type as TrainingTransaction["type"],
    date: tx.date,
  }));
}

export function isCreatedOnOrBefore(createdAt: string | null | undefined, asOfEndInclusive: Date): boolean {
  if (!createdAt) return true;
  const c = parseISO(createdAt);
  if (Number.isNaN(c.getTime())) return true;
  return !isAfter(c, asOfEndInclusive);
}
