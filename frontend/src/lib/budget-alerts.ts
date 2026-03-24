/**
 * Shared budget alert logic - detects when spending exceeds allocated budget per category.
 * Used across BudgetPorts, Transactions, Dashboard, and NotificationsPanel.
 */

const CATEGORY_ALIASES: Record<string, string> = {
  dining: "eating out",
  "eating out": "eating out",
  food: "food",
  groceries: "food",
  shopping: "shopping",
  clothing: "shopping",
  transport: "transport",
  transportation: "transport",
  car: "transport",
  housing: "rent",
  rent: "rent",
  utilities: "utilities",
  tech: "tech",
  smartphone: "tech",
  miscellaneous: "miscellaneous",
  other: "miscellaneous",
};

export function normalizeCategoryForMatch(name: string): string {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, " ");
  return CATEGORY_ALIASES[normalized] ?? normalized;
}

export interface FluxPodLike {
  id: string;
  name: string;
  allocated: number;
  spent: number;
}

export interface TransactionLike {
  category: string;
  amount: number;
  type: string;
}

export interface OverBudgetPod {
  pod: FluxPodLike;
  effectiveSpent: number;
  overBy: number;
}

/**
 * Compute effective spent per pod: pod.spent + sum of expense transactions matching pod category.
 */
export function computeEffectiveSpentByPod(
  pods: FluxPodLike[],
  transactions: TransactionLike[]
): Record<string, number> {
  const categoryTotals: Record<string, number> = {};
  transactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      const key = normalizeCategoryForMatch(tx.category);
      categoryTotals[key] = (categoryTotals[key] ?? 0) + Math.abs(tx.amount);
    });

  const out: Record<string, number> = {};
  pods.forEach((pod) => {
    const key = normalizeCategoryForMatch(pod.name);
    const fromTx = categoryTotals[key] ?? 0;
    out[pod.id] = pod.spent + fromTx;
  });
  return out;
}

/**
 * Get pods where effective spent exceeds allocated budget.
 */
export function getOverBudgetPods(
  pods: FluxPodLike[],
  transactions: TransactionLike[]
): OverBudgetPod[] {
  const effectiveSpent = computeEffectiveSpentByPod(pods, transactions);
  const over: OverBudgetPod[] = [];
  pods.forEach((pod) => {
    const spent = effectiveSpent[pod.id] ?? pod.spent;
    if (spent > pod.allocated) {
      over.push({
        pod,
        effectiveSpent: spent,
        overBy: spent - pod.allocated,
      });
    }
  });
  return over;
}

/**
 * Check if adding a specific expense would push a matching pod over budget.
 * Returns the matching over-budget info if so.
 */
export interface BudgetHeadroom {
  podName: string;
  allocated: number;
  effectiveSpent: number;
  /** Room left before adding this expense */
  remainingBefore: number;
  /** Room left after adding this expense (0 if over) */
  remainingAfter: number;
  /** Amount over the limit (0 if still within budget) */
  overBy: number;
}

/**
 * For a planned expense, show how much room is left in the matching budget (if any).
 */
export function getExpenseBudgetHeadroom(
  pods: FluxPodLike[],
  transactions: TransactionLike[],
  expense: { category: string; amount: number }
): BudgetHeadroom | null {
  const key = normalizeCategoryForMatch(expense.category);
  const pod = pods.find((p) => normalizeCategoryForMatch(p.name) === key);
  if (!pod || expense.amount <= 0) return null;

  const effectiveByPod = computeEffectiveSpentByPod(pods, transactions);
  const spent = effectiveByPod[pod.id] ?? pod.spent;
  const remainingBefore = pod.allocated - spent;
  const after = spent + expense.amount;
  const remainingAfter = pod.allocated - after;
  const overBy = remainingAfter < 0 ? -remainingAfter : 0;

  return {
    podName: pod.name,
    allocated: pod.allocated,
    effectiveSpent: spent,
    remainingBefore,
    remainingAfter: Math.max(0, remainingAfter),
    overBy,
  };
}

/**
 * Enforces “every expense must map to a budget pod” (same name rules as headroom / over-budget checks).
 * When podsHaveLoaded is false, returns null so callers don’t block while flux_pods are still loading.
 */
export function getExpenseBudgetRequirementMessage(
  pods: FluxPodLike[],
  category: string,
  podsHaveLoaded: boolean
): string | null {
  if (!podsHaveLoaded) return null;
  if (pods.length === 0) {
    return "Add at least one budget on the Budgets page before recording expenses.";
  }
  const key = normalizeCategoryForMatch(category);
  const matchingPod = pods.find((p) => normalizeCategoryForMatch(p.name) === key);
  if (!matchingPod) {
    return `No budget matches “${category}”. Add a budget for this category on the Budgets page (use the same category name), or pick a different category.`;
  }
  return null;
}

export function wouldExceedBudget(
  pods: FluxPodLike[],
  transactions: TransactionLike[],
  newExpense: { category: string; amount: number }
): OverBudgetPod | null {
  const key = normalizeCategoryForMatch(newExpense.category);
  const matchingPod = pods.find((p) => normalizeCategoryForMatch(p.name) === key);
  if (!matchingPod) return null;

  const categoryTotal = transactions
    .filter((tx) => tx.type === "expense" && normalizeCategoryForMatch(tx.category) === key)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const effectiveSpent = matchingPod.spent + categoryTotal + newExpense.amount;
  if (effectiveSpent > matchingPod.allocated) {
    return {
      pod: matchingPod,
      effectiveSpent,
      overBy: effectiveSpent - matchingPod.allocated,
    };
  }
  return null;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}
