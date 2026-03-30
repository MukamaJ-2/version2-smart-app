/**
 * Blends categorization quality + anomaly detection (local rules + optional RF batch API) for LLM context.
 */

import { aiFetch } from "../api";
import { detectAnomaly, getAmountRatio } from "./models/anomaly-detector";
import type { TrainingTransaction } from "./training-data";

const UNCATEGORIZED = new Set(
  ["miscellaneous", "other", "other/unknown", "uncategorized", ""].map((s) => s.toLowerCase())
);

const MAX_ANOMALY_SCAN = 72;
const ANOMALY_LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;

export interface InsightModelSignals {
  categoryQuality: {
    expenseCount: number;
    miscellaneousRatio: number;
    /** Short guidance for users and LLMs */
    note: string;
  };
  anomalySummary: {
    scannedCount: number;
    flaggedCount: number;
    highSeverityCount: number;
    /** Up to 3 short reasons from flagged rows */
    sampleReasons: string[];
    note: string;
    /** When RF batch ran; count of rows the trained model flagged */
    rfFlaggedCount?: number;
    /** True when backend batch succeeded (may be 0 flags) */
    rfScanUsed?: boolean;
  };
  /** Single block for Gemini / Smart Money prompts */
  summaryForPrompt: string;
}

function isMiscCategory(cat: string): boolean {
  return UNCATEGORIZED.has((cat ?? "").trim().toLowerCase());
}

export function recentExpensesForScan(transactions: TrainingTransaction[]): TrainingTransaction[] {
  const expenses = transactions.filter((tx) => tx.type === "expense");
  const cutoff = Date.now() - ANOMALY_LOOKBACK_MS;
  const withTime = expenses.filter((tx) => {
    const t = new Date(tx.date).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
  const sorted = [...withTime].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return sorted.slice(0, MAX_ANOMALY_SCAN);
}

interface BatchRow {
  transaction_type: string;
  category: string;
  amount_ratio: number;
  payment_mode: string;
}

async function fetchRfBatchFlags(rows: BatchRow[]): Promise<boolean[] | null> {
  if (rows.length === 0) return [];
  try {
    const res = await aiFetch("/api/v1/detect-anomaly-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: rows }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: Array<{ isAnomaly: boolean }> };
    const results = data.results;
    if (!Array.isArray(results) || results.length !== rows.length) return null;
    return results.map((r) => Boolean(r.isAnomaly));
  } catch {
    return null;
  }
}

function buildScanRows(
  toScan: TrainingTransaction[],
  historicalTransactions: TrainingTransaction[]
): { rows: BatchRow[]; ratios: number[] } {
  const rows: BatchRow[] = [];
  const ratios: number[] = [];
  for (const tx of toScan) {
    const txType = (tx.type ?? "expense").toString().toLowerCase();
    const amount = Math.abs(tx.amount);
    const ratio = getAmountRatio(amount, tx.category, txType, historicalTransactions);
    ratios.push(ratio);
    rows.push({
      transaction_type: txType,
      category: (tx.category ?? "Miscellaneous").toLowerCase().trim(),
      amount_ratio: ratio,
      payment_mode: "Unknown",
    });
  }
  return { rows, ratios };
}

/**
 * Computes category-spread + **local-only** anomaly counts (sync, no HTTP).
 */
export function computeInsightModelSignals(transactions: TrainingTransaction[]): InsightModelSignals {
  const expenses = transactions.filter((tx) => tx.type === "expense");
  const nExp = expenses.length;
  const nMisc = expenses.filter((tx) => isMiscCategory(tx.category)).length;
  const miscellaneousRatio = nExp > 0 ? nMisc / nExp : 0;

  const catNote =
    miscellaneousRatio <= 0.15
      ? "Category labels look diverse enough for reliable spending breakdowns."
      : miscellaneousRatio <= 0.35
        ? "A noticeable share of expenses are Miscellaneous — refining categories would sharpen insights."
        : "Many expenses are uncategorized (Miscellaneous) — trends and tips may be less precise until you recategorize.";

  const toScan = recentExpensesForScan(transactions);
  let flaggedCount = 0;
  let highSeverityCount = 0;
  const reasonSet = new Set<string>();

  for (const tx of toScan) {
    const r = detectAnomaly(tx, transactions);
    if (r.isAnomaly) {
      flaggedCount += 1;
      if (r.severity === "high" || r.severity === "critical") highSeverityCount += 1;
      if (reasonSet.size < 4 && r.reason) reasonSet.add(r.reason);
    }
  }

  const sampleReasons = [...reasonSet].slice(0, 3);
  const anomalyNote =
    flaggedCount === 0
      ? "No unusual amounts vs your own past patterns were flagged in recent expenses."
      : highSeverityCount > 0
        ? `${flaggedCount} recent expense(s) look unusual vs your history (${highSeverityCount} higher priority) — worth a quick review.`
        : `${flaggedCount} recent expense(s) deviate somewhat from your usual pattern — review if anything looks off.`;

  const summaryForPrompt = [
    "=== MODEL-ASSISTED SIGNALS (local anomaly rules + category quality) ===",
    `Category quality: ${(miscellaneousRatio * 100).toFixed(0)}% of expenses are Miscellaneous/Other (${nMisc}/${nExp}). ${catNote}`,
    `Anomaly scan (last ~90 days, up to ${toScan.length} expenses): ${flaggedCount} flagged (local rules); ${highSeverityCount} high/critical severity.`,
    sampleReasons.length ? `Examples: ${sampleReasons.join(" | ")}` : "",
    "Use these only as hints — do not invent amounts. Suggest reviewing Transactions when anomalies are high.",
    "=== END MODEL SIGNALS ===",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    categoryQuality: {
      expenseCount: nExp,
      miscellaneousRatio: Math.round(miscellaneousRatio * 10000) / 10000,
      note: catNote,
    },
    anomalySummary: {
      scannedCount: toScan.length,
      flaggedCount,
      highSeverityCount,
      sampleReasons,
      note: anomalyNote,
    },
    summaryForPrompt,
  };
}

/**
 * Same as {@link computeInsightModelSignals} but when the AI API is reachable, blends **trained RF** batch scores
 * with local rules (union per tx; severity uses RF ratio ≥ 5 as high when RF flags).
 */
export async function computeInsightModelSignalsAsync(
  transactions: TrainingTransaction[]
): Promise<InsightModelSignals> {
  const expenses = transactions.filter((tx) => tx.type === "expense");
  const nExp = expenses.length;
  const nMisc = expenses.filter((tx) => isMiscCategory(tx.category)).length;
  const miscellaneousRatio = nExp > 0 ? nMisc / nExp : 0;

  const catNote =
    miscellaneousRatio <= 0.15
      ? "Category labels look diverse enough for reliable spending breakdowns."
      : miscellaneousRatio <= 0.35
        ? "A noticeable share of expenses are Miscellaneous — refining categories would sharpen insights."
        : "Many expenses are uncategorized (Miscellaneous) — trends and tips may be less precise until you recategorize.";

  const toScan = recentExpensesForScan(transactions);
  const { rows, ratios } = buildScanRows(toScan, transactions);

  const rfFlags = await fetchRfBatchFlags(rows);
  const rfScanUsed = rfFlags !== null;
  let rfFlagged = 0;
  if (rfFlags) {
    for (const f of rfFlags) if (f) rfFlagged += 1;
  }

  let flaggedCount = 0;
  let highSeverityCount = 0;
  const reasonSet = new Set<string>();

  for (let i = 0; i < toScan.length; i++) {
    const tx = toScan[i];
    const local = detectAnomaly(tx, transactions);
    const rf = rfFlags?.[i] ?? false;
    const ratio = ratios[i] ?? 1;
    const union = local.isAnomaly || rf;
    if (!union) continue;

    flaggedCount += 1;
    const highLocal = local.severity === "high" || local.severity === "critical";
    const highRf = rf && ratio >= 5;
    if (highLocal || highRf) highSeverityCount += 1;

    if (reasonSet.size < 4) {
      if (rf && ratio >= 1.5) {
        reasonSet.add(
          ratio >= 3
            ? `${tx.category}: ~${ratio.toFixed(1)}× typical (RF)`
            : `${tx.category}: unusual vs pattern (RF)`
        );
      } else if (local.reason) {
        reasonSet.add(local.reason);
      }
    }
  }

  const sampleReasons = [...reasonSet].slice(0, 3);

  let anomalyNote: string;
  if (flaggedCount === 0) {
    anomalyNote =
      "No unusual amounts vs your own past patterns were flagged in recent expenses (local + RF when available).";
  } else if (!rfScanUsed) {
    anomalyNote =
      highSeverityCount > 0
        ? `${flaggedCount} recent expense(s) look unusual vs your history (${highSeverityCount} higher priority) — worth a quick review. (RF API unavailable; local rules only.)`
        : `${flaggedCount} recent expense(s) deviate somewhat from your usual pattern — review if anything looks off. (RF API unavailable.)`;
  } else {
    anomalyNote =
      highSeverityCount > 0
        ? `${flaggedCount} recent expense(s) flagged (blend of local rules + RF); ${highSeverityCount} higher priority — worth a quick review.`
        : `${flaggedCount} recent expense(s) flagged (blend of local rules + RF) — review if anything looks off.`;
  }

  const rfLine = rfScanUsed
    ? `RF model: ${rfFlagged} of ${toScan.length} scored as anomaly; merged with local duplicate/first-time checks.`
    : "RF model: not used (offline or error); local rules only.";

  const summaryForPrompt = [
    "=== MODEL-ASSISTED SIGNALS (category quality + local rules + RF batch when available) ===",
    `Category quality: ${(miscellaneousRatio * 100).toFixed(0)}% of expenses are Miscellaneous/Other (${nMisc}/${nExp}). ${catNote}`,
    `Anomaly scan (last ~90 days, up to ${toScan.length} expenses): ${flaggedCount} flagged (union); ${highSeverityCount} high/critical or RF≥5×.`,
    rfLine,
    sampleReasons.length ? `Examples: ${sampleReasons.join(" | ")}` : "",
    "Use these only as hints — do not invent amounts. Suggest reviewing Transactions when anomalies are high.",
    "=== END MODEL SIGNALS ===",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    categoryQuality: {
      expenseCount: nExp,
      miscellaneousRatio: Math.round(miscellaneousRatio * 10000) / 10000,
      note: catNote,
    },
    anomalySummary: {
      scannedCount: toScan.length,
      flaggedCount,
      highSeverityCount,
      sampleReasons,
      note: anomalyNote,
      rfFlaggedCount: rfScanUsed ? rfFlagged : undefined,
      rfScanUsed,
    },
    summaryForPrompt,
  };
}
