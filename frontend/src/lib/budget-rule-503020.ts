/**
 * 50/30/20 Budget Rule mapping
 * Needs 50% | Wants 30% | Savings 20%
 */

export type BudgetRuleCategory = "needs" | "wants" | "savings";

export const BUDGET_RULE_TARGETS = {
  needs: 0.5,
  wants: 0.3,
  savings: 0.2,
} as const;

/** Map pod/category names to 50/30/20 buckets (case-insensitive) */
const NEEDS_KEYWORDS = [
  "rent", "utilities", "housing", "mortgage", "insurance", "health",
  "transport", "transportation", "fuel", "gas", "communication",
  "food", "groceries", "debt", "education", "medical",
];
const WANTS_KEYWORDS = [
  "eating out", "dining", "coffee", "entertainment", "shopping",
  "clothing", "travel", "personal care", "gifts", "donations",
  "subscription", "streaming", "hobby", "miscellaneous",
];
const SAVINGS_KEYWORDS = [
  "savings", "emergency", "goal", "investment", "retirement",
];

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function getBudgetRuleCategory(podOrCategoryName: string): BudgetRuleCategory {
  const n = normalize(podOrCategoryName);
  if (SAVINGS_KEYWORDS.some((kw) => n.includes(kw))) return "savings";
  if (WANTS_KEYWORDS.some((kw) => n.includes(kw))) return "wants";
  if (NEEDS_KEYWORDS.some((kw) => n.includes(kw))) return "needs";
  return "wants"; // default
}

export const BUDGET_RULE_LABELS: Record<BudgetRuleCategory, { label: string; short: string }> = {
  needs: { label: "Needs (50%)", short: "50%" },
  wants: { label: "Wants (30%)", short: "30%" },
  savings: { label: "Savings (20%)", short: "20%" },
};
