import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { aiService } from "@/lib/ai/ai-service";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { normalizeCategoryForMatch } from "@/lib/budget-alerts";

interface FluxPod {
  id: string;
  name: string;
  allocated: number;
  spent: number;
}

interface GoalRow {
  monthly_contribution: number;
  name: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function OptimizeBudgetDialog({
  open,
  onOpenChange,
  fluxPods,
  monthlyIncome,
  transactions,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fluxPods: FluxPod[];
  monthlyIncome: number;
  transactions: Array<{ category: string; amount: number; type: string }>;
  onApply: (allocations: Record<string, number>) => void;
}) {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [result, setResult] = useState<{
    allocations: Record<string, number>;
    feasible: boolean;
    violations: string[];
    reasoning: string[];
    savingsAmount: number;
  } | null>(null);

  useEffect(() => {
    if (!open || !isSupabaseConfigured) return;
    supabase
      .from("goals")
      .select("name, monthly_contribution")
      .then(({ data }) => setGoals((data ?? []) as GoalRow[]));
  }, [open]);

  useEffect(() => {
    if (!open || fluxPods.length === 0 || monthlyIncome <= 0) {
      setResult(null);
      return;
    }

    const categoryTotals: Record<string, number> = {};
    transactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        const key = normalizeCategoryForMatch(tx.category);
        categoryTotals[key] = (categoryTotals[key] ?? 0) + tx.amount;
      });

    const historicalSpending: Record<string, number> = {};
    fluxPods.forEach((pod) => {
      const key = normalizeCategoryForMatch(pod.name);
      historicalSpending[pod.name] = categoryTotals[key] ?? 0;
    });

    const res = aiService.optimizeBudget({
      totalIncome: monthlyIncome,
      categories: fluxPods.map((p) => p.name),
      constraints: fluxPods.map((p) => ({
        category: p.name,
        minAmount: Math.max(p.spent, p.allocated * 0.5),
        maxAmount: p.allocated * 1.5,
        priority: "flexible" as const,
        currentAmount: p.allocated,
      })),
      goals: goals.map((g) => ({
        name: g.name,
        monthlyContribution: g.monthly_contribution,
        priority: "required" as const,
      })),
      historicalSpending,
      savingsTarget: 0.1,
    });

    setResult({
      allocations: res.allocations,
      feasible: res.feasible,
      violations: res.violations,
      reasoning: res.reasoning,
      savingsAmount: res.savingsAmount,
    });
  }, [open, fluxPods, monthlyIncome, transactions, goals]);

  const handleApply = () => {
    if (!result?.feasible || !result.allocations) return;
    onApply(result.allocations);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>Suggested budget split</span>
          </DialogTitle>
        </DialogHeader>

        {result && (
          <div className="space-y-4">
            {result.violations.length > 0 && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive">
                {result.violations.map((v, i) => (
                  <p key={i}>{v}</p>
                ))}
              </div>
            )}

            {result.reasoning.length > 0 && (
              <p className="text-sm text-muted-foreground">{result.reasoning[0]}</p>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {Object.entries(result.allocations).map(([cat, amount]) => {
                const current = fluxPods.find((p) => p.name === cat)?.allocated ?? 0;
                const diff = amount - current;
                return (
                  <div
                    key={cat}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/20"
                  >
                    <span className="font-medium text-sm">{cat}</span>
                    <div className="text-right">
                      <span className="font-mono text-sm font-bold">
                        {formatCurrency(amount)}
                      </span>
                      {diff !== 0 && (
                        <span
                          className={`ml-2 text-xs ${
                            diff > 0 ? "text-success" : "text-destructive"
                          }`}
                        >
                          {diff > 0 ? "+" : ""}
                          {formatCurrency(diff)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {result.savingsAmount > 0 && (
              <p className="text-sm text-success font-medium">
                Projected savings: {formatCurrency(result.savingsAmount)}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={!result.feasible}
                className="bg-gradient-primary hover:opacity-90"
              >
                Use these amounts
              </Button>
            </div>
          </div>
        )}

        {!result && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Working out suggestions…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
