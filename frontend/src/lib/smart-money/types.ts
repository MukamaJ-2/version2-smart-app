/**
 * Smart Money multi-agent pipeline — types aligned with Supabase `transactions` rows.
 */

import type { InsightModelSignals } from "@/lib/ai/insightModelSignals";

export interface SmartMoneyTransactionInput {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  time?: string;
}

export interface SmartMoneyInsights {
  totalSpend: number;
  spendByCategory: Record<string, number>;
  spendByMonth: Record<string, number>;
  expenseTransactionCount: number;
}

export interface SmartMoneyEvaluation {
  nTransactions: number;
  nUncategorized: number;
  otherRatio: number;
  totalSpend: number;
  passesOtherRatioCheck: boolean;
}

export interface SmartMoneyMetrics {
  runtimeMs: number;
  nExpenseTransactions: number;
  nCategories: number;
}

export type TraceEvent = Record<string, string | number | boolean | undefined>;

export interface SmartMoneyPipelineResult {
  insights: SmartMoneyInsights;
  baselineReport: string;
  evaluation: SmartMoneyEvaluation;
  metrics: SmartMoneyMetrics;
  trace: TraceEvent[];
  /** Category quality + anomaly signals (local + RF batch when API is up) for LLM advice */
  insightModelSignals: InsightModelSignals;
}
