import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, Target, Zap, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { aiService } from "@/lib/ai/ai-service";

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  date: string;
}

interface Goal {
  id: string;
  name: string;
  deadline: string;
  status: "on-track" | "mild-pressure" | "critical";
}

const colorClasses = {
  primary: {
    bg: "bg-primary/10",
    text: "text-primary",
    glow: "shadow-glow-sm",
  },
  success: {
    bg: "bg-success/10",
    text: "text-success",
    glow: "shadow-glow-success",
  },
  accent: {
    bg: "bg-accent/10",
    text: "text-accent",
    glow: "shadow-glow-warning",
  },
  secondary: {
    bg: "bg-secondary/10",
    text: "text-secondary",
    glow: "shadow-glow-secondary",
  },
};

export default function QuickStats({ simulatedMonths = 0 }: { simulatedMonths?: number }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCountdownNow(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isActive = true;
    const loadStats = async () => {
      if (!isSupabaseConfigured) return;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive) return;
      if (userError || !userData.user) return;
      setUserId(userData.user.id);
      const { data: txData } = await supabase
        .from("transactions")
        .select("id,amount,type,date")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      setTransactions((txData ?? []) as Transaction[]);
      const { data: goalData } = await supabase
        .from("goals")
        .select("id,name,deadline,status")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      setGoals((goalData ?? []) as Goal[]);
    };
    loadStats();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const txChannel = supabase
      .channel("quick-stats-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = payload.new as Transaction;
            setTransactions((prev) => (prev.some((tx) => tx.id === created.id) ? prev : [...prev, created]));
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Transaction;
            setTransactions((prev) => prev.map((tx) => (tx.id === updated.id ? updated : tx)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setTransactions((prev) => prev.filter((tx) => tx.id !== removedId));
          }
        }
      )
      .subscribe();

    const goalsChannel = supabase
      .channel("quick-stats-goals")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = payload.new as Goal;
            setGoals((prev) => (prev.some((goal) => goal.id === created.id) ? prev : [...prev, created]));
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as Goal;
            setGoals((prev) => prev.map((goal) => (goal.id === updated.id ? updated : goal)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setGoals((prev) => prev.filter((goal) => goal.id !== removedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(goalsChannel);
    };
  }, [userId]);

  const stats = useMemo(() => {
    const income = transactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
    const expense = transactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
    const balance = income - expense;
    const savingsRate = income > 0 ? Math.max(0, Math.min(1, (income - expense) / income)) : 0;
    const healthScore = Math.round(savingsRate * 100);
    const activeGoals = goals.length;
    const onTrackRatio = goals.length
      ? Math.round((goals.filter((g) => g.status === "on-track").length / goals.length) * 100)
      : 0;
    const sortedDeadlines = goals
      .map((goal) => ({ name: goal.name, date: new Date(goal.deadline) }))
      .filter((goal) => !Number.isNaN(goal.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const nextDeadline = sortedDeadlines[0];
    let daysToDeadline = nextDeadline
      ? Math.max(0, Math.ceil((nextDeadline.date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    let displayBalance = balance;
    let displayHealthScore = healthScore;
    let displayOnTrackRatio = onTrackRatio;

    if (simulatedMonths > 0) {
      // Basic simulation mapping
      const simulatedState = aiService.simulateFutureState(
        simulatedMonths,
        [], // we don't need pods for quick stats currently
        goals.map(g => ({ ...g, targetAmount: 0, currentAmount: 0, monthlyContribution: 0 })), // mock for now, we just need net worth generally
        balance
      );
      displayBalance = simulatedState.projectedNetWorth;
      // If balance is going up, health is good.
      displayHealthScore = Math.min(100, healthScore + (simulatedMonths * 2));
      displayOnTrackRatio = Math.min(100, onTrackRatio + (simulatedMonths * 5));
      daysToDeadline = Math.max(0, daysToDeadline - (simulatedMonths * 30));
    }

    return [
      {
        label: simulatedMonths > 0 ? `Projected Balance (+${simulatedMonths}M)` : "Today's Balance",
        value: new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(displayBalance),
        change: income > 0 ? `+${new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(income)}` : "No income yet",
        isPositive: income > 0 ? displayBalance >= 0 : null,
        icon: Wallet,
        color: simulatedMonths > 0 && displayBalance < balance ? "secondary" : "primary",
        link: "/transactions",
      },
      {
        label: simulatedMonths > 0 ? "Projected Health" : "Monthly Health",
        value: `${displayHealthScore}`,
        suffix: "/100",
        change: income > 0 ? `${displayHealthScore} pts` : "No data yet",
        isPositive: income > 0 ? displayHealthScore >= 50 : null,
        icon: Zap,
        color: "success",
        link: "/reports",
      },
      {
        label: "Active Goals",
        value: `${activeGoals}`,
        suffix: " goals",
        change: goals.length ? `${displayOnTrackRatio}% on track` : "No goals yet",
        isPositive: goals.length ? displayOnTrackRatio >= 50 : null,
        icon: Target,
        color: "accent",
        link: "/goals",
      },
      {
        label: "Next Deadline",
        value: nextDeadline ? `${daysToDeadline}` : "—",
        suffix: nextDeadline ? " days" : "",
        change: nextDeadline ? nextDeadline.name : "No deadlines yet",
        isPositive: null,
        icon: Calendar,
        color: "secondary",
        link: "/goals",
      },
    ];
  }, [transactions, goals, countdownNow, simulatedMonths]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const colors = colorClasses[stat.color as keyof typeof colorClasses];
        return (
          <Link
            key={stat.label}
            to={stat.link}
            className="block"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card rounded-xl p-4 hover:glass-card-glow transition-all duration-300 group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${colors.bg} ${colors.glow} group-hover:scale-110 transition-transform`}>
                  <stat.icon className={`w-4 h-4 ${colors.text}`} />
                </div>
                {stat.isPositive !== null && (
                  <div className={`flex items-center gap-1 text-xs ${stat.isPositive ? "text-success" : "text-destructive"}`}>
                    {stat.isPositive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    <span>{stat.change}</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                {stat.label}
              </p>
              <div className="flex items-baseline gap-1">
                <span className={`font-mono text-2xl font-bold ${colors.text} text-glow-sm`}>
                  {stat.value}
                </span>
                {stat.suffix && (
                  <span className="text-sm text-muted-foreground">{stat.suffix}</span>
                )}
              </div>
              {stat.isPositive === null && (
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              )}
            </motion.div>
          </Link>
        );
      })}
    </div>
  );
}
