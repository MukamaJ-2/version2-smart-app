/**
 * Constraint-Based Budget Optimizer
 * Solves optimal budget allocation under hard and soft constraints.
 */

export interface BudgetConstraint {
  category: string;
  minAmount?: number;
  maxAmount?: number;
  priority: "required" | "optional" | "flexible";
  currentAmount?: number;
}

export interface GoalConstraint {
  name: string;
  monthlyContribution: number;
  priority: "required" | "optional";
}

export interface OptimizerInput {
  totalIncome: number;
  categories: string[];
  constraints: BudgetConstraint[];
  goals: GoalConstraint[];
  historicalSpending: Record<string, number>;
  savingsTarget?: number; // min % of income to save
}

export interface OptimizerResult {
  allocations: Record<string, number>;
  totalAllocated: number;
  remaining: number;
  savingsAmount: number;
  feasible: boolean;
  violations: string[];
  reasoning: string[];
}

export function optimizeBudget(input: OptimizerInput): OptimizerResult {
  const {
    totalIncome,
    categories,
    constraints,
    goals,
    historicalSpending,
    savingsTarget = 0.1,
  } = input;

  const violations: string[] = [];
  const reasoning: string[] = [];
  const allocations: Record<string, number> = {};

  const requiredGoals = goals
    .filter((g) => g.priority === "required")
    .reduce((s, g) => s + g.monthlyContribution, 0);

  const minSavings = totalIncome * savingsTarget;
  const availableAfterGoals = totalIncome - requiredGoals - minSavings;

  if (availableAfterGoals < 0) {
    violations.push(
      `Income (${totalIncome}) cannot cover required goals (${requiredGoals}) + minimum savings (${minSavings})`
    );
    return {
      allocations: {},
      totalAllocated: 0,
      remaining: totalIncome,
      savingsAmount: 0,
      feasible: false,
      violations,
      reasoning,
    };
  }

  const categoryConstraints = new Map<string, BudgetConstraint>();
  constraints.forEach((c) => categoryConstraints.set(c.category, c));

  let totalAllocated = 0;
  const flexible = categories.filter((c) => {
    const con = categoryConstraints.get(c);
    return !con || con.priority !== "required";
  });

  const required = categories.filter((c) => {
    const con = categoryConstraints.get(c);
    return con?.priority === "required" && con.minAmount != null;
  });

  for (const cat of required) {
    const con = categoryConstraints.get(cat)!;
    const amount = Math.max(con.minAmount ?? 0, con.currentAmount ?? 0);
    allocations[cat] = amount;
    totalAllocated += amount;
  }

  let budgetForFlexible = availableAfterGoals - totalAllocated;

  if (budgetForFlexible < 0) {
    violations.push("Required allocations exceed available budget");
    return {
      allocations,
      totalAllocated,
      remaining: totalIncome - totalAllocated,
      savingsAmount: 0,
      feasible: false,
      violations,
      reasoning,
    };
  }

  const historicalTotal = Object.values(historicalSpending).reduce((s, v) => s + v, 0);
  const weights = flexible.map((cat) => {
    const hist = historicalSpending[cat] ?? 0;
    const share = historicalTotal > 0 ? hist / historicalTotal : 1 / flexible.length;
    return { cat, share, hist };
  });

  const totalWeight = weights.reduce((s, w) => s + w.share, 0) || 1;

  for (const { cat, share } of weights) {
    const con = categoryConstraints.get(cat);
    let amount = (budgetForFlexible * share) / totalWeight;

    if (con) {
      if (con.minAmount != null) amount = Math.max(amount, con.minAmount);
      if (con.maxAmount != null) amount = Math.min(amount, con.maxAmount);
    }

    allocations[cat] = Math.round(amount);
    totalAllocated += allocations[cat];
  }

  const remaining = totalIncome - totalAllocated - requiredGoals;
  const savingsAmount = Math.max(0, remaining);

  if (remaining < 0) {
    violations.push("Allocation exceeds available budget; reduce flexible categories");
  }

  reasoning.push(
    `Allocated ${totalAllocated} across ${categories.length} categories. ` +
    `Goals: ${requiredGoals}. Savings: ${savingsAmount}.`
  );

  return {
    allocations,
    totalAllocated,
    remaining,
    savingsAmount,
    feasible: violations.length === 0,
    violations,
    reasoning,
  };
}
