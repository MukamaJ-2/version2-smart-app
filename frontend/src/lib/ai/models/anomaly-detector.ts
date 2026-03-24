/**
 * Anomaly Detection Model
 * Uses trained Random Forest model via backend API when available; falls back to local rules.
 */

import type { TrainingTransaction } from "../training-data";
import { trainedCategoryStats } from "./artifacts/anomaly-detector";
import { getUserEmail } from "../../notifications";

import { AI_API_URL } from "../../api";

export interface AnomalyResult {
  isAnomaly: boolean;
  anomalyScore: number; // 0-1, higher = more anomalous
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  severityLabel: string;
  suggestedAction?: string;
  dataQuality?: "low" | "medium" | "high";
  fingerprint?: string; // for false positive tracking
  /** amount / median for same category, type – used for "~9× your usual" style messages */
  amountRatio?: number;
  /** median amount for this category/type (UGX) – used for budget suggestions */
  typicalAmount?: number;
  /** Insight type for advice flows */
  insightType?: "high_spend" | "low_spend" | "first_time_category" | "possible_duplicate";
}

/* ───────── False Positive Learning ───────── */

interface FPEntry {
  fingerprint: string;
  category: string;
  amountMin: number;
  amountMax: number;
  dismissedAt: string;
  count: number;
}

const FP_STORAGE_KEY = "uniguard.anomalyFP";

function loadFPStore(): FPEntry[] {
  try {
    return JSON.parse(localStorage.getItem(FP_STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

function saveFPStore(entries: FPEntry[]) {
  localStorage.setItem(FP_STORAGE_KEY, JSON.stringify(entries));
}

/** Call when user dismisses an anomaly as false positive */
export function recordFalsePositive(result: AnomalyResult, category: string, amount: number) {
  const store = loadFPStore();
  const fp = result.fingerprint ?? `${category}-${Math.round(amount / 1000)}`;
  const isFirstTimeCategory = fp.endsWith("-new");
  const amountMin = isFirstTimeCategory ? 0 : amount * 0.8;
  const amountMax = isFirstTimeCategory ? Number.MAX_SAFE_INTEGER : amount * 1.2;
  const existing = store.find((e) => e.fingerprint === fp);
  if (existing) {
    existing.count += 1;
    existing.dismissedAt = new Date().toISOString();
    if (!isFirstTimeCategory) {
      existing.amountMin = Math.min(existing.amountMin, amount * 0.8);
      existing.amountMax = Math.max(existing.amountMax, amount * 1.2);
    } else {
      existing.amountMin = 0;
      existing.amountMax = Number.MAX_SAFE_INTEGER;
    }
  } else {
    store.push({
      fingerprint: fp,
      category,
      amountMin,
      amountMax,
      dismissedAt: new Date().toISOString(),
      count: 1,
    });
  }
  saveFPStore(store.slice(-100)); // keep last 100
}

/** Check if a transaction matches a previously dismissed pattern */
function isSuppressed(category: string, amount: number): boolean {
  const store = loadFPStore();
  return store.some(
    (e) => e.category === category && amount >= e.amountMin && amount <= e.amountMax && e.count >= 1
  );
}

/** Retrieve all FP entries (for UI display) */
export function getFalsePositiveEntries(): FPEntry[] {
  return loadFPStore();
}

/** Clear a specific FP entry so anomalies reappear */
export function clearFalsePositive(fingerprint: string) {
  saveFPStore(loadFPStore().filter((e) => e.fingerprint !== fingerprint));
}

function severityLabel(severity: "low" | "medium" | "high" | "critical"): string {
  switch (severity) {
    case "critical": return "Critical — requires immediate attention";
    case "high": return "High — unusual pattern detected";
    case "medium": return "Moderate — worth reviewing";
    case "low": return "Low — minor deviation";
  }
}

const ANOMALY_THRESHOLD_SCALE = 1.0;
const HARD_ANOMALY_AMOUNT = 1_000_000;
const EXTREME_ANOMALY_MULTIPLIER = 10;

/**
 * Simulated trained Isolation Forest model for anomaly detection
 */
export function detectAnomaly(
  transaction: TrainingTransaction,
  historicalTransactions: TrainingTransaction[]
): AnomalyResult {
  const category = transaction.category;
  const amount = Math.abs(transaction.amount);

  // ---- False Positive Suppression ----
  if (isSuppressed(category, amount)) {
    return {
      isAnomaly: false,
      anomalyScore: 0,
      reason: "Previously dismissed by user",
      severity: "low",
      severityLabel: severityLabel("low"),
      dataQuality: "high",
      fingerprint: `${category}-${Math.round(amount / 1000)}`,
    };
  }

  const expenseHistory = historicalTransactions.filter((tx) => tx.type === transaction.type);
  if (expenseHistory.length > 0) {
    const allAmounts = expenseHistory.map((tx) => Math.abs(tx.amount)).sort((a, b) => a - b);
    const medianAll = median(allAmounts);
    if (medianAll > 0 && amount >= medianAll * EXTREME_ANOMALY_MULTIPLIER) {
      return {
        isAnomaly: true,
        anomalyScore: 0.95,
        reason: `Amount (${amount} UGX) is ${EXTREME_ANOMALY_MULTIPLIER}x your typical spend`,
        severity: "critical",
        severityLabel: severityLabel("critical"),
        suggestedAction: "Verify this transaction immediately — possible fraud or error",
        dataQuality: expenseHistory.length >= 10 ? "medium" : "low",
        fingerprint: `${category}-${Math.round(amount / 1000)}`,
      };
    }
  }

  if (historicalTransactions.length < 10) {
    if (amount >= HARD_ANOMALY_AMOUNT) {
      return {
        isAnomaly: true,
        anomalyScore: 0.8,
        reason: `Amount (${amount} UGX) is unusually large`,
        severity: "high",
        severityLabel: severityLabel("high"),
        suggestedAction: "Please verify this transaction is correct",
        dataQuality: "low",
        fingerprint: `${category}-${Math.round(amount / 1000)}`,
      };
    }
    return {
      isAnomaly: false,
      anomalyScore: 0,
      reason: "Insufficient historical data",
      severity: "low",
      severityLabel: severityLabel("low"),
      dataQuality: "low",
    };
  }
  const categoryTx = historicalTransactions.filter(
    (tx) => tx.category === category && tx.type === transaction.type
  );
  
  if (categoryTx.length === 0) {
    // New category - could be anomaly
    return {
      isAnomaly: true,
      anomalyScore: 0.6,
      reason: "Transaction in new category",
      severity: "medium",
      severityLabel: severityLabel("medium"),
      suggestedAction: "Verify category is correct",
      dataQuality: "low",
      fingerprint: `${category}-new`,
    };
  }
  
  if (categoryTx.length < 5) {
    const trained = trainedCategoryStats[category];
    if (!trained) {
      return {
        isAnomaly: false,
        anomalyScore: 0,
        reason: "Insufficient category history",
        severity: "low",
        severityLabel: severityLabel("low"),
        dataQuality: "low",
      };
    }

    const zScore = trained.mad > 0
      ? Math.abs(0.6745 * (amount - trained.median) / trained.mad)
      : trained.median === 0
        ? 0
        : Math.abs((amount - trained.median) / trained.median);

    const threshold = trained.p98 ?? trained.p97 ?? trained.p95 ?? trained.p90;
    if (threshold && amount >= threshold * ANOMALY_THRESHOLD_SCALE) {
      return {
        isAnomaly: true,
        anomalyScore: 0.7,
        reason: `Amount (${amount} UGX) is above typical ${category} spending`,
        severity: "medium",
        severityLabel: severityLabel("medium"),
        suggestedAction: "Double-check this transaction",
        dataQuality: "low",
        fingerprint: `${category}-${Math.round(amount / 1000)}`,
      };
    }

    if (zScore > 3) {
      return {
        isAnomaly: true,
        anomalyScore: Math.min(zScore / 5, 1),
        reason: `Amount (${amount} UGX) is unusual for ${category} based on trained norms`,
        severity: "high",
        severityLabel: severityLabel("high"),
        suggestedAction: "Please verify this transaction is correct",
        dataQuality: "low",
        fingerprint: `${category}-${Math.round(amount / 1000)}`,
      };
    }

    if (zScore > 2) {
      return {
        isAnomaly: true,
        anomalyScore: Math.min(zScore / 4, 1),
        reason: `Amount is higher than expected for ${category} based on trained norms`,
        severity: "medium",
        severityLabel: severityLabel("medium"),
        suggestedAction: "Double-check this transaction",
        dataQuality: "low",
        fingerprint: `${category}-${Math.round(amount / 1000)}`,
      };
    }

    return {
      isAnomaly: false,
      anomalyScore: Math.min(zScore / 3, 1),
      reason: "Limited category history; using trained norms",
      severity: "low",
      severityLabel: severityLabel("low"),
      dataQuality: "low",
    };
  }
  
  // Calculate statistics for this category
  const amounts = categoryTx.map((tx) => Math.abs(tx.amount));
  const mean = amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;
  const variance = amounts.reduce((sum, amt) => sum + Math.pow(amt - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  const medianAmount = median(amounts);
  const mad = median(amounts.map((value) => Math.abs(value - medianAmount))) || 0;
  const trained = trainedCategoryStats[category];
  
  // Robust Z-score calculation (MAD) with fallback to standard deviation
  const zScore = mad > 0
    ? Math.abs(0.6745 * (amount - medianAmount) / mad)
    : stdDev === 0
      ? (amount === mean ? 0 : 10)
      : Math.abs((amount - mean) / stdDev);
  
  // Anomaly thresholds
  let isAnomaly = false;
  let severity: "low" | "medium" | "high" | "critical" = "low";
  let reason = "";
  let anomalyScore = 0;
  
  const threshold = trained?.p98 ?? trained?.p97 ?? trained?.p95 ?? trained?.p90;
  if (threshold && amount >= threshold * ANOMALY_THRESHOLD_SCALE) {
    isAnomaly = true;
    severity = "low";
    reason = `Amount (${amount} UGX) is above typical ${category} spending`;
    anomalyScore = 0.45;
  }

  if (zScore > 3) {
    // Very unusual (3+ standard deviations)
    isAnomaly = true;
    severity = "high";
    reason = `Amount (${amount} UGX) is ${zScore.toFixed(1)}x the average for ${category}`;
    anomalyScore = Math.min(zScore / 5, 1); // Normalize to 0-1
    if (amount > mean * 2) {
      reason += " - Unusually large transaction";
    } else {
      reason += " - Unusually small transaction";
    }
  } else if (zScore > 2) {
    // Moderately unusual
    isAnomaly = true;
    severity = "medium";
    reason = `Amount is ${zScore.toFixed(1)}x the average for ${category}`;
    anomalyScore = zScore / 4;
  } else if (zScore > 1.5) {
    // Slightly unusual
    isAnomaly = true;
    severity = "low";
    reason = `Slightly unusual amount for ${category}`;
    anomalyScore = zScore / 3;
  }
  
  // Check for duplicate transactions (same amount, same day)
  const sameDay = historicalTransactions.filter(
    (tx) =>
      tx.date === transaction.date &&
      Math.abs(Math.abs(tx.amount) - amount) < 10 && // Within 10 UGX
      tx.category === category &&
      tx.type === transaction.type
  );
  
  if (sameDay.length > 1 && !isAnomaly) {
    isAnomaly = true;
    severity = "medium";
    reason = "Possible duplicate transaction";
    anomalyScore = 0.6;
  }
  
  // Check for unusual merchant patterns
  if (transaction.merchant) {
    const merchantTx = historicalTransactions.filter(
      (tx) => tx.merchant?.toLowerCase() === transaction.merchant?.toLowerCase()
    );
    
    if (merchantTx.length === 0 && amount > mean * 1.5) {
      isAnomaly = true;
      severity = "medium";
      reason = `First transaction with ${transaction.merchant} - verify merchant`;
      anomalyScore = Math.max(anomalyScore, 0.5);
    }
  }
  
  let suggestedAction: string | undefined;
  if (isAnomaly && severity === "high") {
    suggestedAction = "Please verify this transaction is correct";
  } else if (isAnomaly && severity === "medium") {
    suggestedAction = "Double-check this transaction";
  }
  
  return {
    isAnomaly,
    anomalyScore: Math.min(anomalyScore, 1),
    reason,
    severity,
    severityLabel: severityLabel(severity),
    suggestedAction,
    dataQuality: categoryTx.length >= 20 ? "high" : "medium",
    fingerprint: `${category}-${Math.round(amount / 1000)}`,
  };
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Build human-readable insight message from amount_ratio and typical spend */
function buildInsightMessage(
  amount: number,
  category: string,
  ratio: number,
  typicalAmount: number | undefined,
  isAnomaly: boolean
): { reason: string; insightType?: "high_spend" | "low_spend" | "first_time_category" | "possible_duplicate" } {
  if (!isAnomaly) {
    return { reason: "Normal transaction" };
  }
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-UG", { maximumFractionDigits: 0 }).format(n) + " UGX";

  if (ratio >= 3) {
    const mult = ratio >= 10 ? Math.round(ratio) : ratio >= 5 ? "~" + Math.round(ratio) : "~" + ratio.toFixed(1);
    return {
      reason: `This ${fmt(amount)} ${category} charge is ${mult}× your usual${typicalAmount ? ` (~${fmt(typicalAmount)})` : ""} – did you mean to log this?`,
      insightType: "high_spend",
    };
  }
  if (ratio <= 0.25 && typicalAmount) {
    return {
      reason: `You usually spend ~${fmt(typicalAmount)} on ${category} – this ${fmt(amount)} entry looks low. Did you forget something?`,
      insightType: "low_spend",
    };
  }
  return {
    reason: `Amount (${fmt(amount)}) is unusual for ${category} based on your spending`,
    insightType: ratio > 1 ? "high_spend" : "low_spend",
  };
}

/** Compute amount_ratio = amount / median(amounts for same category, type) */
function getAmountRatio(
  amount: number,
  category: string,
  txType: string,
  historical: TrainingTransaction[]
): number {
  const typeNorm = (txType ?? "expense").toString().toLowerCase();
  const categoryTx = historical.filter(
    (tx) => tx.category === category && (tx.type ?? "expense").toString().toLowerCase() === typeNorm
  );
  if (categoryTx.length === 0) return 1.0;
  const amounts = categoryTx.map((tx) => Math.abs(tx.amount));
  const med = median(amounts);
  return med > 0 ? amount / med : 1.0;
}

/**
 * Detect anomaly using trained Random Forest via backend API.
 * Falls back to local detectAnomaly if API is unavailable.
 */
export async function detectAnomalyWithModel(
  transaction: TrainingTransaction,
  historicalTransactions: TrainingTransaction[]
): Promise<AnomalyResult> {
  const category = transaction.category;
  const amount = Math.abs(transaction.amount);

  if (isSuppressed(category, amount)) {
    return {
      isAnomaly: false,
      anomalyScore: 0,
      reason: "Previously dismissed by user",
      severity: "low",
      severityLabel: severityLabel("low"),
      dataQuality: "high",
      fingerprint: `${category}-${Math.round(amount / 1000)}`,
    };
  }

  const txType = (transaction.type ?? "expense").toString().toLowerCase();
  const categoryTx = historicalTransactions.filter(
    (tx) => tx.category === category && (tx.type ?? "expense").toString().toLowerCase() === txType
  );

  // First-time category: no prior transactions in this category
  if (categoryTx.length === 0) {
    return {
      isAnomaly: true,
      anomalyScore: 0.6,
      reason: `First transaction in ${category} – confirm the category is correct.`,
      severity: "medium",
      severityLabel: severityLabel("medium"),
      suggestedAction: "Verify category is correct",
      dataQuality: "low",
      fingerprint: `${category}-new`,
      insightType: "first_time_category",
    };
  }

  // Possible duplicate: same amount, same day
  const sameDay = historicalTransactions.filter(
    (tx) =>
      tx.date === transaction.date &&
      Math.abs(Math.abs(tx.amount) - amount) < 10 &&
      tx.category === category &&
      (tx.type ?? "expense").toString().toLowerCase() === (transaction.type ?? "expense").toString().toLowerCase()
  );
  if (sameDay.length > 1) {
    return {
      isAnomaly: true,
      anomalyScore: 0.6,
      reason: `Same amount, same day – could this be a duplicate?`,
      severity: "medium",
      severityLabel: severityLabel("medium"),
      suggestedAction: "Check if you logged this twice",
      dataQuality: "high",
      fingerprint: `${category}-${Math.round(amount / 1000)}-dup`,
      insightType: "possible_duplicate",
    };
  }

  const amountRatio = getAmountRatio(amount, category, txType, historicalTransactions);

  try {
    const notifyEmail = getUserEmail();
    const res = await fetch(`${AI_API_URL}/api/v1/detect-anomaly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transaction_type: txType,
        category: category.toLowerCase().trim(),
        amount_ratio: amountRatio,
        payment_mode: "Unknown",
        ...(notifyEmail ? { notifyEmail } : {}),
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { isAnomaly: boolean; anomalyScore?: number; amountRatio?: number };
      const ratio = data.amountRatio ?? amountRatio;
      const categoryTx = historicalTransactions.filter(
        (tx) => tx.category === category && tx.type === txType
      );
      const typicalAmount = categoryTx.length > 0
        ? median(categoryTx.map((tx) => Math.abs(tx.amount)))
        : undefined;

      const { reason, insightType } = buildInsightMessage(amount, category, ratio, typicalAmount, data.isAnomaly);
      const severity = data.isAnomaly ? (ratio >= 5 ? "high" : ratio <= 0.2 ? "medium" : "medium") : "low";

      return {
        isAnomaly: data.isAnomaly,
        anomalyScore: data.anomalyScore ?? (data.isAnomaly ? 0.7 : 0),
        reason,
        severity,
        severityLabel: severityLabel(severity),
        suggestedAction: data.isAnomaly ? "Double-check this transaction" : undefined,
        dataQuality: historicalTransactions.length >= 20 ? "high" : "medium",
        fingerprint: `${category}-${Math.round(amount / 1000)}`,
        amountRatio: ratio,
        typicalAmount,
        insightType: data.isAnomaly ? insightType : undefined,
      };
    }
  } catch {
    // API unavailable, fall through to local
  }

  return detectAnomaly(transaction, historicalTransactions);
}

/**
 * Batch anomaly detection
 */
export function detectAnomalies(
  transactions: TrainingTransaction[],
  historicalTransactions: TrainingTransaction[]
): Array<{ transaction: TrainingTransaction; anomaly: AnomalyResult }> {
  return transactions.map((tx) => ({
    transaction: tx,
    anomaly: detectAnomaly(tx, historicalTransactions),
  }));
}

