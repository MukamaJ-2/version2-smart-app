/**
 * Typical spend computation for budget suggestions and spending habit view.
 * Uses median-based metrics to reduce impact of anomalous transactions.
 */

import type { TrainingTransaction } from "./training-data";

export interface TypicalSpendByCategory {
  category: string;
  typicalMonthly: number;
  transactionCount: number;
  medianTransaction: number;
  /** Suggested budget = typical + ~20% buffer */
  suggestedBudget: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Compute typical spend per category from historical transactions.
 * Uses median transaction size and monthly aggregation to reduce anomaly impact.
 */
export function getTypicalSpendByCategory(
  transactions: Array<{ category: string; amount: number; type: string; date: string }>
): TypicalSpendByCategory[] {
  const expenses = transactions.filter((tx) => tx.type === "expense");
  if (expenses.length === 0) return [];

  const byCategory: Record<string, { amounts: number[]; dates: string[] }> = {};
  expenses.forEach((tx) => {
    if (!byCategory[tx.category]) {
      byCategory[tx.category] = { amounts: [], dates: [] };
    }
    byCategory[tx.category].amounts.push(Math.abs(tx.amount));
    byCategory[tx.category].dates.push(tx.date);
  });

  const now = new Date();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const results: TypicalSpendByCategory[] = [];
  for (const [category, { amounts, dates }] of Object.entries(byCategory)) {
    const medianTx = median(amounts);
    // Monthly total = sum of amounts in last 90 days / 3
    const recent = amounts.filter((_, i) => new Date(dates[i]) >= ninetyDaysAgo);
    const totalRecent = recent.reduce((s, a) => s + a, 0);
    const monthsOfData = 3;
    const typicalMonthly = totalRecent > 0 ? totalRecent / monthsOfData : medianTx * Math.max(1, amounts.length / 3);
    const suggestedBudget = Math.round(typicalMonthly * 1.2); // 20% buffer

    results.push({
      category,
      typicalMonthly: Math.round(typicalMonthly),
      transactionCount: amounts.length,
      medianTransaction: Math.round(medianTx),
      suggestedBudget,
    });
  }

  return results.sort((a, b) => b.typicalMonthly - a.typicalMonthly);
}

/**
 * Budget suggestion message for a category.
 * e.g. "Your typical Food spend is 50k/month. Set a budget around 60k to allow some flexibility."
 */
export function getBudgetSuggestionMessage(
  category: string,
  typicalMonthly: number,
  suggestedBudget: number
): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n) + " UGX";
  return `You usually spend about ${fmt(typicalMonthly)} per month on ${category}. A comfortable monthly limit might be ${fmt(suggestedBudget)} (a little extra room).`;
}
