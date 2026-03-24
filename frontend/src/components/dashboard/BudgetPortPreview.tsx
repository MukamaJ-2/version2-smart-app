import { motion } from "framer-motion";
import { Home, ShoppingBag, PiggyBank, AlertTriangle, CheckCircle, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { computeEffectiveSpentByPod } from "@/lib/budget-alerts";
import {
  getBudgetRuleCategory,
  BUDGET_RULE_TARGETS,
  type BudgetRuleCategory as RuleCat,
} from "@/lib/budget-rule-503020";

interface BudgetPort {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  status: "healthy" | "warning" | "critical";
}

interface TransactionRow {
  category: string;
  amount: number;
  type: string;
}

function computeStatus(allocated: number, spent: number): "healthy" | "warning" | "critical" {
  if (allocated <= 0) return "healthy";
  const pct = (spent / allocated) * 100;
  if (pct >= 100) return "critical";
  if (pct >= 80) return "warning";
  return "healthy";
}

const statusConfig = {
  healthy: {
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    icon: CheckCircle,
    dot: "bg-success",
  },
  warning: {
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    icon: AlertTriangle,
    dot: "bg-warning",
  },
  critical: {
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    icon: AlertTriangle,
    dot: "bg-destructive",
  },
};

const ruleConfig: Record<RuleCat, { icon: typeof Home; color: string; bg: string }> = {
  needs: { icon: Home, color: "text-primary", bg: "bg-primary/15" },
  wants: { icon: ShoppingBag, color: "text-secondary", bg: "bg-secondary/15" },
  savings: { icon: PiggyBank, color: "text-success", bg: "bg-success/15" },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function BudgetPortPreview() {
  const [ports, setPorts] = useState<BudgetPort[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const loadData = async () => {
      if (!isSupabaseConfigured) return;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive) return;
      if (userError || !userData.user) return;
      setUserId(userData.user.id);
      const [podsRes, txRes] = await Promise.all([
        supabase
          .from("flux_pods")
          .select("id,name,allocated,spent,status")
          .eq("user_id", userData.user.id)
          .order("created_at", { ascending: true }),
        supabase
          .from("transactions")
          .select("category,amount,type")
          .eq("user_id", userData.user.id),
      ]);
      if (!isActive) return;
      setPorts((podsRes.data ?? []) as BudgetPort[]);
      setTransactions((txRes.data ?? []) as TransactionRow[]);
    };
    loadData();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channelPods = supabase
      .channel("budget-port-preview-pods")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flux_pods", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = payload.new as BudgetPort;
            setPorts((prev) => (prev.some((p) => p.id === created.id) ? prev : [...prev, created]));
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as BudgetPort;
            setPorts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setPorts((prev) => prev.filter((p) => p.id !== removedId));
          }
        }
      )
      .subscribe();
    const channelTx = supabase
      .channel("budget-port-preview-tx")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        () => {
          supabase
            .from("transactions")
            .select("category,amount,type")
            .eq("user_id", userId)
            .then(({ data }) => setTransactions((data ?? []) as TransactionRow[]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channelPods);
      supabase.removeChannel(channelTx);
    };
  }, [userId]);

  const effectiveSpent = useMemo(
    () => computeEffectiveSpentByPod(ports, transactions),
    [ports, transactions]
  );

  const { ruleBreakdown, portsByRule } = useMemo(() => {
    const totalAllocated = ports.reduce((s, p) => s + p.allocated, 0) || 1;
    const byRule: Record<RuleCat, Array<BudgetPort & { spent: number; status: "healthy" | "warning" | "critical" }>> = {
      needs: [],
      wants: [],
      savings: [],
    };

    ports.forEach((port) => {
      const spent = effectiveSpent[port.id] ?? port.spent;
      const status = computeStatus(port.allocated, spent);
      const category = getBudgetRuleCategory(port.name);
      byRule[category].push({ ...port, spent, status });
    });

    const needsTotal = byRule.needs.reduce((s, p) => s + p.allocated, 0);
    const wantsTotal = byRule.wants.reduce((s, p) => s + p.allocated, 0);
    const savingsTotal = byRule.savings.reduce((s, p) => s + p.allocated, 0);

    return {
      ruleBreakdown: {
        needs: { allocated: needsTotal, target: BUDGET_RULE_TARGETS.needs * 100 },
        wants: { allocated: wantsTotal, target: BUDGET_RULE_TARGETS.wants * 100 },
        savings: { allocated: savingsTotal, target: BUDGET_RULE_TARGETS.savings * 100 },
        total: totalAllocated,
      },
      portsByRule: byRule,
    };
  }, [ports, effectiveSpent]);

  const previewPorts = useMemo(() => {
    const all: Array<BudgetPort & { spent: number; status: "healthy" | "warning" | "critical"; rule: RuleCat }> = [];
    (["needs", "wants", "savings"] as const).forEach((rule) => {
      portsByRule[rule].slice(0, 2).forEach((p) => all.push({ ...p, rule }));
    });
    return all.slice(0, 4);
  }, [portsByRule]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <PiggyBank className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground tracking-tight">
              Your budgets
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Simple split: needs, wants, savings
            </p>
          </div>
        </div>
        <Link
          to="/budget-ports"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-glow transition-colors"
        >
          View All
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 50/30/20 Visual Bar */}
      {ports.length > 0 && (
        <div className="mb-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-muted/50">
            <motion.div
              className="bg-primary"
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(100, (ruleBreakdown.total > 0 ? (ruleBreakdown.needs.allocated / ruleBreakdown.total) * 100 : 0))}%`,
              }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            <motion.div
              className="bg-secondary"
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(100, (ruleBreakdown.total > 0 ? (ruleBreakdown.wants.allocated / ruleBreakdown.total) * 100 : 0))}%`,
              }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
            />
            <motion.div
              className="bg-success"
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(100, (ruleBreakdown.total > 0 ? (ruleBreakdown.savings.allocated / ruleBreakdown.total) * 100 : 0))}%`,
              }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>Needs {ruleBreakdown.total > 0 ? Math.min(100, Math.round((ruleBreakdown.needs.allocated / ruleBreakdown.total) * 100)) : 0}%</span>
            <span>Wants {ruleBreakdown.total > 0 ? Math.min(100, Math.round((ruleBreakdown.wants.allocated / ruleBreakdown.total) * 100)) : 0}%</span>
            <span>Savings {ruleBreakdown.total > 0 ? Math.min(100, Math.round((ruleBreakdown.savings.allocated / ruleBreakdown.total) * 100)) : 0}%</span>
          </div>
        </div>
      )}

      {/* Budget list */}
      <div className="space-y-2">
        {previewPorts.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No budgets yet. Add one to see your needs / wants / savings split.
          </div>
        )}
        {previewPorts.map((port, index) => {
          const config = statusConfig[port.status];
          const rule = ruleConfig[port.rule];
          const RuleIcon = rule.icon;
          const safeAllocated = port.allocated > 0 ? port.allocated : 1;
          const percentageRaw = (port.spent / safeAllocated) * 100;
          const percentage = Math.max(0, Math.min(999, percentageRaw));
          const remaining = port.allocated - port.spent;

          return (
            <Link key={port.id} to="/budget-ports">
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.05 }}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:shadow-md",
                  config.bg,
                  config.border,
                  "hover:scale-[1.01]"
                )}
              >
                <div className={cn("p-1.5 rounded-lg", rule.bg)}>
                  <RuleIcon className={cn("w-3.5 h-3.5", rule.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {port.name}
                    </span>
                    <span className={cn("text-xs font-mono font-bold shrink-0", config.color)}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden mt-1.5">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        port.status === "healthy" && "bg-success",
                        port.status === "warning" && "bg-warning",
                        port.status === "critical" && "bg-destructive"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(percentage, 100)}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{formatCurrency(port.spent)} spent</span>
                    <span className={cn("font-mono", remaining >= 0 ? "text-success" : "text-destructive")}>
                      {formatCurrency(remaining)} left
                    </span>
                  </div>
                </div>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
