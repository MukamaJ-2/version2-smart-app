import type {
  SmartMoneyEvaluation,
  SmartMoneyInsights,
  SmartMoneyMetrics,
  SmartMoneyPipelineResult,
  SmartMoneyTransactionInput,
  TraceEvent,
} from "./types";
import { computeInsightModelSignals, computeInsightModelSignalsAsync } from "@/lib/ai/insightModelSignals";
import type { TrainingTransaction } from "@/lib/ai/training-data";

const UNCATEGORIZED = new Set(
  ["miscellaneous", "other", "other/unknown", "uncategorized", ""].map((s) => s.toLowerCase())
);

function pushTrace(trace: TraceEvent[], step: string, extra?: Record<string, string | number | boolean>) {
  trace.push({ step, t: performance.now(), ...extra });
}

function monthKeyFromDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "invalid";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function normalizeExpenseCategory(raw: string): string {
  const t = raw?.trim();
  if (!t) return "Miscellaneous";
  return t;
}

function toTrainingTransactions(rows: SmartMoneyTransactionInput[]): TrainingTransaction[] {
  return rows.map((tx) => ({
    description: tx.description,
    amount: tx.amount,
    category: tx.category,
    type: tx.type,
    date: tx.date,
  }));
}

/**
 * Build spending insights from the customer's expense rows only.
 * Categories come from the user's own data (no external CSV).
 */
export function computeInsights(expenses: SmartMoneyTransactionInput[]): SmartMoneyInsights {
  const spendByCategory: Record<string, number> = {};
  const spendByMonth: Record<string, number> = {};
  let totalSpend = 0;

  for (const tx of expenses) {
    const cat = normalizeExpenseCategory(tx.category);
    const amt = Math.abs(Number(tx.amount)) || 0;
    totalSpend += amt;
    spendByCategory[cat] = (spendByCategory[cat] ?? 0) + amt;
    const mk = monthKeyFromDate(tx.date);
    if (mk !== "invalid") {
      spendByMonth[mk] = (spendByMonth[mk] ?? 0) + amt;
    }
  }

  return {
    totalSpend,
    spendByCategory,
    spendByMonth,
    expenseTransactionCount: expenses.length,
  };
}

export function generateBaselineReport(
  insights: SmartMoneyInsights,
  monthlyBudgetUgx: number | null | undefined
): string {
  const lines: string[] = [];
  lines.push("UniGuard X-T Smart Money — summary");
  lines.push(`- Total expenses (all loaded data): ${formatUgx(insights.totalSpend)}`);
  lines.push("- Top categories:");
  const top = Object.entries(insights.spendByCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);
  for (const [k, v] of top) {
    lines.push(`  • ${k}: ${formatUgx(v)}`);
  }
  if (monthlyBudgetUgx != null && monthlyBudgetUgx > 0) {
    lines.push(`\n- Monthly budget: ${formatUgx(monthlyBudgetUgx)}`);
    const months = Object.entries(insights.spendByMonth).sort(([a], [b]) => a.localeCompare(b));
    for (const [m, amt] of months) {
      const status = amt > monthlyBudgetUgx ? "Over budget" : "Within budget";
      lines.push(`  • ${m}: ${formatUgx(amt)} (${status})`);
    }
  }
  return lines.join("\n");
}

function formatUgx(n: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(Math.max(0, n));
}

export function evaluateCategorization(
  expenses: SmartMoneyTransactionInput[],
  insights: SmartMoneyInsights,
  maxOtherRatio: number
): SmartMoneyEvaluation {
  const n = expenses.length;
  const nUncategorized = expenses.filter((tx) =>
    UNCATEGORIZED.has(normalizeExpenseCategory(tx.category).toLowerCase())
  ).length;
  const otherRatio = n > 0 ? nUncategorized / n : 0;
  return {
    nTransactions: n,
    nUncategorized,
    otherRatio: Math.round(otherRatio * 10000) / 10000,
    totalSpend: insights.totalSpend,
    passesOtherRatioCheck: otherRatio <= maxOtherRatio,
  };
}

export interface RunPipelineOptions {
  monthlyBudgetUgx?: number | null;
  /** Fraction of expense rows allowed in Miscellaneous/Other before failing the check */
  maxOtherRatio?: number;
}

/**
 * Orchestrates loader → insights → report → evaluation (deterministic stages).
 * Uses only the transaction list supplied by the app (e.g. from Supabase for the signed-in user).
 */
export function runSmartMoneyPipeline(
  transactions: SmartMoneyTransactionInput[],
  options: RunPipelineOptions = {}
): SmartMoneyPipelineResult {
  const t0 = performance.now();
  const trace: TraceEvent[] = [];
  const maxOtherRatio = options.maxOtherRatio ?? 0.35;

  pushTrace(trace, "load_start", { n_rows: transactions.length });
  const expenses = transactions.filter((tx) => tx.type === "expense");
  pushTrace(trace, "load_done", { n_expenses: expenses.length });

  pushTrace(trace, "insights_start");
  const insights = computeInsights(expenses);
  pushTrace(trace, "insights_done", {
    total_spend: insights.totalSpend,
    n_months: Object.keys(insights.spendByMonth).length,
  });

  pushTrace(trace, "report_start");
  const baselineReport = generateBaselineReport(insights, options.monthlyBudgetUgx);
  pushTrace(trace, "report_done");

  pushTrace(trace, "evaluate_start");
  const evaluation = evaluateCategorization(expenses, insights, maxOtherRatio);
  pushTrace(trace, "evaluate_done", { other_ratio: evaluation.otherRatio });

  const insightModelSignals = computeInsightModelSignals(toTrainingTransactions(transactions));
  pushTrace(trace, "model_signals_done", {
    misc_ratio: insightModelSignals.categoryQuality.miscellaneousRatio,
    anomalies: insightModelSignals.anomalySummary.flaggedCount,
  });

  const t1 = performance.now();
  const metrics: SmartMoneyMetrics = {
    runtimeMs: Math.round((t1 - t0) * 100) / 100,
    nExpenseTransactions: expenses.length,
    nCategories: Object.keys(insights.spendByCategory).length,
  };

  return {
    insights,
    baselineReport,
    evaluation,
    metrics,
    trace,
    insightModelSignals,
  };
}

/** Same as {@link runSmartMoneyPipeline} but uses RF + local blend for `insightModelSignals` when the ML API is up. */
export async function runSmartMoneyPipelineAsync(
  transactions: SmartMoneyTransactionInput[],
  options: RunPipelineOptions = {}
): Promise<SmartMoneyPipelineResult> {
  const t0 = performance.now();
  const trace: TraceEvent[] = [];
  const maxOtherRatio = options.maxOtherRatio ?? 0.35;

  pushTrace(trace, "load_start", { n_rows: transactions.length });
  const expenses = transactions.filter((tx) => tx.type === "expense");
  pushTrace(trace, "load_done", { n_expenses: expenses.length });

  pushTrace(trace, "insights_start");
  const insights = computeInsights(expenses);
  pushTrace(trace, "insights_done", {
    total_spend: insights.totalSpend,
    n_months: Object.keys(insights.spendByMonth).length,
  });

  pushTrace(trace, "report_start");
  const baselineReport = generateBaselineReport(insights, options.monthlyBudgetUgx);
  pushTrace(trace, "report_done");

  pushTrace(trace, "evaluate_start");
  const evaluation = evaluateCategorization(expenses, insights, maxOtherRatio);
  pushTrace(trace, "evaluate_done", { other_ratio: evaluation.otherRatio });

  const insightModelSignals = await computeInsightModelSignalsAsync(toTrainingTransactions(transactions));
  pushTrace(trace, "model_signals_done", {
    misc_ratio: insightModelSignals.categoryQuality.miscellaneousRatio,
    anomalies: insightModelSignals.anomalySummary.flaggedCount,
  });

  const t1 = performance.now();
  const metrics: SmartMoneyMetrics = {
    runtimeMs: Math.round((t1 - t0) * 100) / 100,
    nExpenseTransactions: expenses.length,
    nCategories: Object.keys(insights.spendByCategory).length,
  };

  return {
    insights,
    baselineReport,
    evaluation,
    metrics,
    trace,
    insightModelSignals,
  };
}
