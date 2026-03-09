import { useState, useCallback } from "react";

export interface BudgetPot {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  status: "healthy" | "warning" | "critical";
  velocity: number;
  category: "needs" | "wants" | "savings";
  rollover?: number;
  children?: BudgetPot[];
}

export interface BudgetRuleBreakdown {
  income: number;
  rule: { needs: number; wants: number; savings: number };
  actual: {
    needs: { spent: number };
    wants: { spent: number };
    savings: { spent: number };
  };
}

export interface SmartAlert {
  id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

function generateId(): string {
  return `pot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function computeStatus(allocated: number, spent: number): "healthy" | "warning" | "critical" {
  if (allocated <= 0) return "healthy";
  const pct = (spent / allocated) * 100;
  if (pct >= 100) return "critical";
  if (pct >= 80) return "warning";
  return "healthy";
}

function computeVelocity(allocated: number, spent: number): number {
  const remaining = allocated - spent;
  if (remaining <= 0) return 0;
  const daily = allocated / 30;
  if (daily <= 0) return 30;
  return Math.round(remaining / daily);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

const DEFAULT_POTS: BudgetPot[] = [
  {
    id: "pot-needs-1",
    name: "Rent & Utilities",
    allocated: 500000,
    spent: 320000,
    status: "healthy",
    velocity: 18,
    category: "needs",
    rollover: 0,
  },
  {
    id: "pot-wants-1",
    name: "Eating Out",
    allocated: 150000,
    spent: 98000,
    status: "healthy",
    velocity: 12,
    category: "wants",
    rollover: 0,
  },
  {
    id: "pot-savings-1",
    name: "Emergency Fund",
    allocated: 200000,
    spent: 200000,
    status: "healthy",
    velocity: 30,
    category: "savings",
    rollover: 0,
  },
];

export function useFinancialData() {
  const [pots, setPots] = useState<BudgetPot[]>(() => {
    try {
      const raw = localStorage.getItem("uniguard.budgetPots");
      if (raw) {
        const parsed = JSON.parse(raw) as BudgetPot[];
        return parsed.map((p) => ({
          ...p,
          status: computeStatus(p.allocated, p.spent),
          velocity: computeVelocity(p.allocated, p.spent),
        }));
      }
    } catch (_) {}
    return DEFAULT_POTS;
  });

  const persistPots = useCallback((next: BudgetPot[]) => {
    setPots(next);
    try {
      localStorage.setItem("uniguard.budgetPots", JSON.stringify(next));
    } catch (_) {}
  }, []);

  const addBudgetPot = useCallback(
    (pot: Omit<BudgetPot, "id">) => {
      const newPot: BudgetPot = {
        ...pot,
        id: generateId(),
        status: computeStatus(pot.allocated, pot.spent),
        velocity: computeVelocity(pot.allocated, pot.spent),
        rollover: pot.rollover ?? 0,
      };
      persistPots([...pots, newPot]);
    },
    [pots, persistPots]
  );

  const reallocatePods = useCallback(
    (fromId: string, toId: string, amount: number) => {
      setPots((prev) => {
        const from = prev.find((p) => p.id === fromId);
        const to = prev.find((p) => p.id === toId);
        if (!from || !to || amount <= 0 || from.allocated - from.spent < amount) return prev;
        const next = prev.map((p) => {
          if (p.id === fromId)
            return {
              ...p,
              allocated: p.allocated - amount,
              status: computeStatus(p.allocated - amount, p.spent),
              velocity: computeVelocity(p.allocated - amount, p.spent),
            };
          if (p.id === toId)
            return {
              ...p,
              allocated: p.allocated + amount,
              status: computeStatus(p.allocated + amount, p.spent),
              velocity: computeVelocity(p.allocated + amount, p.spent),
            };
          return p;
        });
        try {
          localStorage.setItem("uniguard.budgetPots", JSON.stringify(next));
        } catch (_) {}
        return next;
      });
    },
    []
  );

  const getBudgetRuleBreakdown = useCallback((): BudgetRuleBreakdown => {
    const income = pots.reduce((s, p) => s + p.allocated, 0) || 1;
    const needsSpent = pots.filter((p) => p.category === "needs").reduce((s, p) => s + p.spent, 0);
    const wantsSpent = pots.filter((p) => p.category === "wants").reduce((s, p) => s + p.spent, 0);
    const savingsSpent = pots.filter((p) => p.category === "savings").reduce((s, p) => s + p.spent, 0);
    return {
      income,
      rule: { needs: 0.5, wants: 0.3, savings: 0.2 },
      actual: {
        needs: { spent: needsSpent },
        wants: { spent: wantsSpent },
        savings: { spent: savingsSpent },
      },
    };
  }, [pots]);

  const getSmartAlerts = useCallback((): SmartAlert[] => {
    const alerts: SmartAlert[] = [];
    pots.forEach((p) => {
      const pct = p.allocated > 0 ? (p.spent / p.allocated) * 100 : 0;
      if (pct >= 100)
        alerts.push({
          id: `alert-${p.id}-over`,
          title: `${p.name} over budget`,
          message: `You've exceeded the allocated amount by ${formatCurrency(p.spent - p.allocated)}.`,
          severity: "critical",
        });
      else if (pct >= 80)
        alerts.push({
          id: `alert-${p.id}-warning`,
          title: `${p.name} nearing limit`,
          message: `${formatCurrency(p.allocated - p.spent)} remaining. Consider reallocating or reducing spending.`,
          severity: "warning",
        });
    });
    return alerts;
  }, [pots]);

  const getDailySpendingLimit = useCallback((): number => {
    const totalAllocated = pots.reduce((s, p) => s + p.allocated, 0);
    const totalSpent = pots.reduce((s, p) => s + p.spent, 0);
    const remaining = totalAllocated - totalSpent;
    const daysLeft = 30 - new Date().getDate();
    if (daysLeft <= 0) return 0;
    return Math.max(0, Math.floor(remaining / daysLeft));
  }, [pots]);

  return {
    budgetPots: pots,
    addBudgetPot,
    reallocatePods,
    getBudgetRuleBreakdown,
    getSmartAlerts,
    getDailySpendingLimit,
  };
}
