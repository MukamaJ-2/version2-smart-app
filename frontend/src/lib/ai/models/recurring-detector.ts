/**
 * Recurring Transaction Detection (Pattern Mining)
 * Detects subscriptions, bills, and recurring payments from transaction history
 * using periodicity analysis and clustering.
 */

export interface TransactionLike {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: string;
  date: string;
}

export type RecurrenceInterval = "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly";

export interface RecurringPattern {
  id: string;
  description: string;
  amount: number;
  amountTolerance: number; // ±% allowed
  category: string;
  interval: RecurrenceInterval;
  intervalDays: number;
  nextExpectedDate: string;
  confidence: number; // 0-1
  occurrenceCount: number;
  transactionIds: string[];
  lastSeen: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .slice(0, 80);
}

function daysBetween(d1: string, d2: string): number {
  return Math.round((
    new Date(d2).getTime() - new Date(d1).getTime()
  ) / MS_PER_DAY);
}

function inferInterval(days: number): RecurrenceInterval {
  if (days <= 10) return "weekly";
  if (days <= 20) return "biweekly";
  if (days <= 45) return "monthly";
  if (days <= 100) return "quarterly";
  return "yearly";
}

function getIntervalDays(interval: RecurrenceInterval): number {
  switch (interval) {
    case "weekly": return 7;
    case "biweekly": return 14;
    case "monthly": return 30;
    case "quarterly": return 90;
    case "yearly": return 365;
    default: return 30;
  }
}

export function detectRecurringPatterns(
  transactions: TransactionLike[]
): RecurringPattern[] {
  const expenses = transactions
    .filter((tx) => tx.type === "expense")
    .sort((a, b) => a.date.localeCompare(b.date));

  if (expenses.length < 2) return [];

  const patterns: RecurringPattern[] = [];
  const seen = new Set<string>();

  for (const tx of expenses) {
    const key = `${normalizeDescription(tx.description)}_${Math.round(tx.amount / 1000) * 1000}`;
    if (seen.has(key)) continue;

    const normDesc = normalizeDescription(tx.description);
    const similar = expenses.filter((t) => {
      const descMatch = normalizeDescription(t.description) === normDesc;
      const amountMatch = Math.abs(t.amount - tx.amount) / Math.max(tx.amount, 1) < 0.15;
      return descMatch && amountMatch;
    });

    if (similar.length < 2) continue;

    const sorted = similar.sort((a, b) => a.date.localeCompare(b.date));
    const intervals: number[] = [];

    for (let i = 1; i < sorted.length; i++) {
      const d = daysBetween(sorted[i - 1].date, sorted[i].date);
      if (d > 0 && d < 400) intervals.push(d);
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((s, t) => s + t, 0) / intervals.length;
    const variance = intervals.reduce((s, t) => s + (t - avgInterval) ** 2, 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgInterval > 0 ? stdDev / avgInterval : 1;

    if (cv > 0.4) continue;

    const interval = inferInterval(avgInterval);
    const intervalDays = getIntervalDays(interval);
    const tolerance = Math.max(0.1, cv * 2);

    const amounts = sorted.map((t) => t.amount);
    const avgAmount = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const amountTolerance = Math.max(avgAmount * 0.1, 1000);

    const lastDate = sorted[sorted.length - 1].date;
    const nextExpected = new Date(lastDate);
    nextExpected.setDate(nextExpected.getDate() + Math.round(avgInterval));

    const confidence = Math.min(
      0.95,
      0.5 + (sorted.length / 6) * 0.2 + (1 - cv) * 0.25
    );

    const patternId = `recur-${normalizeDescription(tx.description).replace(/\s/g, "-")}-${Math.round(avgAmount)}`;
    if (seen.has(patternId)) continue;
    seen.add(patternId);

    patterns.push({
      id: patternId,
      description: tx.description,
      amount: Math.round(avgAmount),
      amountTolerance: Math.round(amountTolerance),
      category: tx.category,
      interval,
      intervalDays: Math.round(avgInterval),
      nextExpectedDate: nextExpected.toISOString().slice(0, 10),
      confidence,
      occurrenceCount: sorted.length,
      transactionIds: sorted.map((t) => t.id),
      lastSeen: lastDate,
    });
  }

  return patterns
    .filter((p) => p.confidence >= 0.55 && p.occurrenceCount >= 2)
    .sort((a, b) => b.confidence - a.confidence);
}

export function formatRecurrenceInterval(interval: RecurrenceInterval): string {
  switch (interval) {
    case "weekly": return "Weekly";
    case "biweekly": return "Bi-weekly";
    case "monthly": return "Monthly";
    case "quarterly": return "Quarterly";
    case "yearly": return "Yearly";
    default: return "Recurring";
  }
}
