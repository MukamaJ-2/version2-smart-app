import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Heart, TrendingUp, PiggyBank, Target, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ───────── Types ───────── */

interface Transaction {
  amount: number;
  type: "income" | "expense";
  date: string;
  category: string;
}

interface GoalRow {
  target_amount: number;
  current_amount: number;
}

interface PodRow {
  allocated: number;
  spent: number;
}

interface SubScore {
  label: string;
  score: number; // 0-100
  icon: typeof Heart;
  color: string;
  detail: string;
}

/* ───────── Score Logic ───────── */

function computeSavingsRate(transactions: Transaction[]): { rate: number; score: number } {
  const income = transactions.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
  const expenses = transactions.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
  if (income === 0) return { rate: 0, score: 0 };
  const rateRaw = ((income - expenses) / income) * 100;
  const rate = Math.min(100, Math.max(0, rateRaw)); // Clamp to 0–100
  // Above 30% = perfect, 20% = good, 10% = ok, below = poor
  const score = Math.min(100, Math.max(0, rate * (100 / 30)));
  return { rate: Math.round(rate), score: Math.round(score) };
}

function computeBudgetAdherence(pods: PodRow[]): { score: number; detail: string } {
  if (pods.length === 0) return { score: 50, detail: "No budgets set up yet" };
  const withinBudget = pods.filter((p) => p.spent <= p.allocated).length;
  const score = Math.round((withinBudget / pods.length) * 100);
  return {
    score,
    detail: `${withinBudget}/${pods.length} budgets on track`,
  };
}

function computeGoalProgress(goals: GoalRow[]): { score: number; detail: string } {
  if (goals.length === 0) return { score: 50, detail: "No goals set yet" };
  const avgProgress = goals.reduce((sum, g) => {
    if (g.target_amount === 0) return sum;
    return sum + Math.min((g.current_amount / g.target_amount) * 100, 100);
  }, 0) / goals.length;
  return {
    score: Math.round(avgProgress),
    detail: `${goals.length} goal${goals.length !== 1 ? "s" : ""}, avg ${Math.round(avgProgress)}% funded`,
  };
}

function computeSpendingTrend(transactions: Transaction[]): { score: number; detail: string } {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const thisMonthExp = transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "expense" && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((s, tx) => s + tx.amount, 0);

  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const lastMonthExp = transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "expense" && d.getMonth() === lastMonth && d.getFullYear() === lastYear;
    })
    .reduce((s, tx) => s + tx.amount, 0);

  if (lastMonthExp === 0) return { score: 70, detail: "Not enough data for trend" };
  const changeRaw = ((thisMonthExp - lastMonthExp) / lastMonthExp) * 100;
  const change = Math.min(999, Math.max(-999, changeRaw)); // Clamp extreme values
  // Spending decreasing = good (100), flat = ok (70), increasing a lot = bad (0)
  const score = Math.min(100, Math.max(0, 70 - change));
  const dir = change <= -5 ? "Decreasing" : change >= 5 ? "Increasing" : "Stable";
  return {
    score: Math.round(score),
    detail: `${dir} (${change >= 0 ? "+" : ""}${change.toFixed(0)}%)`,
  };
}

function computeEmergencyFund(transactions: Transaction[]): { score: number; detail: string } {
  const income = transactions.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
  const expenses = transactions.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
  const saved = income - expenses;
  // Unique months
  const months = new Set(transactions.map((tx) => tx.date.slice(0, 7))).size || 1;
  const avgMonthlyExpense = expenses / months;

  if (avgMonthlyExpense === 0) return { score: 50, detail: "Not enough data" };
  const monthsCovered = saved / avgMonthlyExpense;
  // 6+ months = perfect, 3 = good, 1 = ok, 0 = poor
  const score = Math.min(100, Math.max(0, (monthsCovered / 6) * 100));
  return {
    score: Math.round(score),
    detail: `${monthsCovered.toFixed(1)} months of expenses covered`,
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-primary";
  if (score >= 40) return "text-warning";
  return "text-destructive";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Great";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Needs Work";
  return "Getting Started";
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#00d4ff";
  if (score >= 40) return "#f59e0b";
  return "#ef4444";
}

/* ───────── Component ───────── */

export function FinancialWellnessScore() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [pods, setPods] = useState<PodRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      const { data: userData, error } = await supabase.auth.getUser();
      if (!isActive) return;
      if (error || !userData.user) {
        setIsLoading(false);
        return;
      }
      const uid = userData.user.id;

      const [txRes, goalRes, podRes] = await Promise.all([
        supabase.from("transactions").select("amount,type,date,category").eq("user_id", uid),
        supabase.from("goals").select("target_amount,current_amount").eq("user_id", uid),
        supabase.from("flux_pods").select("allocated,spent").eq("user_id", uid),
      ]);
      if (!isActive) return;

      setTransactions((txRes.data ?? []) as Transaction[]);
      setGoals((goalRes.data ?? []) as GoalRow[]);
      setPods((podRes.data ?? []) as PodRow[]);
      setIsLoading(false);
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  const subScores: SubScore[] = useMemo(() => {
    const savings = computeSavingsRate(transactions);
    const budget = computeBudgetAdherence(pods);
    const goalProg = computeGoalProgress(goals);
    const trend = computeSpendingTrend(transactions);
    const emergency = computeEmergencyFund(transactions);

    return [
      {
        label: "Saving habit",
        score: savings.score,
        icon: PiggyBank,
        color: getScoreColor(savings.score),
        detail: `${savings.rate}% of income not spent`,
      },
      {
        label: "Sticking to budgets",
        score: budget.score,
        icon: Shield,
        color: getScoreColor(budget.score),
        detail: budget.detail,
      },
      {
        label: "Savings goals",
        score: goalProg.score,
        icon: Target,
        color: getScoreColor(goalProg.score),
        detail: goalProg.detail,
      },
      {
        label: "Spending vs last month",
        score: trend.score,
        icon: TrendingUp,
        color: getScoreColor(trend.score),
        detail: trend.detail,
      },
      {
        label: "Rainy-day cushion",
        score: emergency.score,
        icon: Heart,
        color: getScoreColor(emergency.score),
        detail: emergency.detail,
      },
    ];
  }, [transactions, goals, pods]);

  const overallScore = useMemo(() => {
    if (subScores.length === 0) return 0;
    // Weighted average: savings 25%, budget 25%, goals 20%, trend 15%, emergency 15%
    const weights = [0.25, 0.25, 0.20, 0.15, 0.15];
    return Math.round(subScores.reduce((sum, s, i) => sum + s.score * weights[i], 0));
  }, [subScores]);

  const ringColor = getScoreRingColor(overallScore);
  const circumference = 2 * Math.PI * 54; // radius=54
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-40 mb-4" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass-card rounded-2xl p-6 border border-border/60 shadow-lg shadow-primary/5 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-sm font-bold text-foreground tracking-tight">
            How you’re doing
          </h2>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">One overall score</p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Score Ring */}
        <div className="relative w-32 h-32 shrink-0">
          <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
            {/* Background ring */}
            <circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="8"
            />
            {/* Score ring */}
            <motion.circle
              cx="60" cy="60" r="54"
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "circOut", delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-mono text-3xl font-black", getScoreColor(overallScore))}>
              {overallScore}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {getScoreLabel(overallScore)}
            </span>
          </div>
        </div>

        {/* Sub-scores */}
        <div className="flex-1 space-y-2.5 min-w-0">
          {subScores.map((sub) => {
            const Icon = sub.icon;
            return (
              <div key={sub.label} className="flex items-center gap-2.5">
                <Icon className={cn("w-3.5 h-3.5 shrink-0", sub.color)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-foreground font-medium truncate">{sub.label}</span>
                    <span className={cn("text-xs font-mono font-bold", sub.color)}>{sub.score}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-0.5">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: getScoreRingColor(sub.score) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${sub.score}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{sub.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
