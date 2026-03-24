import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Star,
  Zap,
  Target,
  TrendingUp,
  PiggyBank,
  Award,
  Lock,
  CheckCircle,
  Sparkles,
  Receipt,
  Flame,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { computeGamificationState } from "@/lib/gamification/state-machine";
import { getNextAchievable, getPrerequisites } from "@/lib/gamification/achievement-dag";

/* ───────── Types ───────── */

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: typeof Trophy;
  category: "savings" | "goals" | "spending" | "streak" | "milestone";
  points: number;
  unlocked: boolean;
  progress?: number;
  target?: number;
  unlockedDate?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
}

interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
}

interface BudgetPortRow {
  id: string;
  name: string;
  allocated: number;
  spent: number;
}

/* ───────── Achievement Definitions ───────── */
// Each definition has a `compute` function that receives real data and returns { unlocked, progress, target, unlockedDate? }

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: typeof Trophy;
  category: "savings" | "goals" | "spending" | "streak" | "milestone";
  points: number;
  rarity: "common" | "rare" | "epic" | "legendary";
  compute: (data: {
    transactions: Transaction[];
    goals: GoalRow[];
    pods: BudgetPortRow[];
  }) => { unlocked: boolean; progress?: number; target?: number; unlockedDate?: string };
}

function getEarliestDate(transactions: Transaction[]): string | undefined {
  if (transactions.length === 0) return undefined;
  return transactions.reduce((earliest, tx) => (tx.date < earliest ? tx.date : earliest), transactions[0].date);
}

function getTotalSavings(transactions: Transaction[]): number {
  const income = transactions.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
  const expenses = transactions.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
  return Math.max(income - expenses, 0);
}

function getNetWorth(transactions: Transaction[]): number {
  const income = transactions.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
  const expenses = transactions.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);
  return income - expenses;
}

function getConsecutiveDaysWithSavings(transactions: Transaction[]): number {
  if (transactions.length === 0) return 0;
  // Group by date, check each day: if income > expenses for that day, it counts
  const daily: Record<string, { income: number; expenses: number }> = {};
  transactions.forEach((tx) => {
    if (!daily[tx.date]) daily[tx.date] = { income: 0, expenses: 0 };
    if (tx.type === "income") daily[tx.date].income += tx.amount;
    else daily[tx.date].expenses += tx.amount;
  });

  const dates = Object.keys(daily).sort();
  let maxStreak = 0;
  let currentStreak = 0;

  for (const date of dates) {
    if (daily[date].income >= daily[date].expenses) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  return maxStreak;
}

function getUniqueCategories(transactions: Transaction[]): number {
  return new Set(transactions.map((tx) => tx.category)).size;
}

function getMonthlyExpenseReduction(transactions: Transaction[]): number {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const thisMonthExp = transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "expense" && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((s, tx) => s + tx.amount, 0);

  const lastMonthExp = transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "expense" && d.getMonth() === lastMonth && d.getFullYear() === lastYear;
    })
    .reduce((s, tx) => s + tx.amount, 0);

  if (lastMonthExp === 0) return 0;
  return Math.round(((lastMonthExp - thisMonthExp) / lastMonthExp) * 100);
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    id: "first-steps",
    title: "First Steps",
    description: "Record your first transaction",
    icon: CheckCircle,
    category: "milestone",
    points: 10,
    rarity: "common",
    compute: ({ transactions }) => ({
      unlocked: transactions.length >= 1,
      progress: Math.min(transactions.length, 1),
      target: 1,
      unlockedDate: transactions.length >= 1 ? getEarliestDate(transactions) : undefined,
    }),
  },
  {
    id: "ten-transactions",
    title: "Getting Started",
    description: "Record 10 transactions",
    icon: Receipt,
    category: "milestone",
    points: 25,
    rarity: "common",
    compute: ({ transactions }) => ({
      unlocked: transactions.length >= 10,
      progress: Math.min(transactions.length, 10),
      target: 10,
    }),
  },
  {
    id: "fifty-transactions",
    title: "Transaction Pro",
    description: "Record 50 transactions",
    icon: Receipt,
    category: "milestone",
    points: 75,
    rarity: "rare",
    compute: ({ transactions }) => ({
      unlocked: transactions.length >= 50,
      progress: Math.min(transactions.length, 50),
      target: 50,
    }),
  },
  {
    id: "goal-getter",
    title: "Goal Getter",
    description: "Create your first financial goal",
    icon: Target,
    category: "goals",
    points: 30,
    rarity: "common",
    compute: ({ goals }) => ({
      unlocked: goals.length >= 1,
      progress: Math.min(goals.length, 1),
      target: 1,
    }),
  },
  {
    id: "goal-finisher",
    title: "Goal Finisher",
    description: "Fully fund a financial goal",
    icon: Target,
    category: "goals",
    points: 100,
    rarity: "epic",
    compute: ({ goals }) => {
      const completedGoals = goals.filter((g) => g.current_amount >= g.target_amount);
      return {
        unlocked: completedGoals.length >= 1,
        progress: completedGoals.length,
        target: 1,
      };
    },
  },
  {
    id: "goal-crusher",
    title: "Goal Crusher",
    description: "Complete 5 financial goals",
    icon: Award,
    category: "goals",
    points: 200,
    rarity: "legendary",
    compute: ({ goals }) => {
      const completedGoals = goals.filter((g) => g.current_amount >= g.target_amount);
      return {
        unlocked: completedGoals.length >= 5,
        progress: Math.min(completedGoals.length, 5),
        target: 5,
      };
    },
  },
  {
    id: "savings-100k",
    title: "Savings Starter",
    description: "Save UGX 100,000 in total",
    icon: PiggyBank,
    category: "savings",
    points: 50,
    rarity: "common",
    compute: ({ transactions }) => {
      const saved = getTotalSavings(transactions);
      return {
        unlocked: saved >= 100000,
        progress: Math.min(saved, 100000),
        target: 100000,
      };
    },
  },
  {
    id: "savings-500k",
    title: "Savings Expert",
    description: "Save UGX 500,000 in total",
    icon: PiggyBank,
    category: "savings",
    points: 100,
    rarity: "rare",
    compute: ({ transactions }) => {
      const saved = getTotalSavings(transactions);
      return {
        unlocked: saved >= 500000,
        progress: Math.min(saved, 500000),
        target: 500000,
      };
    },
  },
  {
    id: "savings-master",
    title: "Savings Master",
    description: "Save UGX 2,000,000 in total",
    icon: PiggyBank,
    category: "savings",
    points: 200,
    rarity: "epic",
    compute: ({ transactions }) => {
      const saved = getTotalSavings(transactions);
      return {
        unlocked: saved >= 2000000,
        progress: Math.min(saved, 2000000),
        target: 2000000,
      };
    },
  },
  {
    id: "millionaire",
    title: "Millionaire",
    description: "Reach UGX 10,000,000 net worth",
    icon: TrendingUp,
    category: "milestone",
    points: 500,
    rarity: "legendary",
    compute: ({ transactions }) => {
      const nw = getNetWorth(transactions);
      return {
        unlocked: nw >= 10000000,
        progress: Math.max(Math.min(nw, 10000000), 0),
        target: 10000000,
      };
    },
  },
  {
    id: "pod-creator",
    title: "Budget planner",
    description: "Create 3 budgets",
    icon: Zap,
    category: "milestone",
    points: 40,
    rarity: "common",
    compute: ({ pods }) => ({
      unlocked: pods.length >= 3,
      progress: Math.min(pods.length, 3),
      target: 3,
    }),
  },
  {
    id: "pod-master",
    title: "Budget pro",
    description: "Create and use 7 budgets",
    icon: Zap,
    category: "milestone",
    points: 80,
    rarity: "rare",
    compute: ({ pods }) => ({
      unlocked: pods.length >= 7,
      progress: Math.min(pods.length, 7),
      target: 7,
    }),
  },
  {
    id: "streak-7",
    title: "Weekly Streak",
    description: "7 consecutive days with positive daily balance",
    icon: Flame,
    category: "streak",
    points: 50,
    rarity: "common",
    compute: ({ transactions }) => {
      const streak = getConsecutiveDaysWithSavings(transactions);
      return {
        unlocked: streak >= 7,
        progress: Math.min(streak, 7),
        target: 7,
      };
    },
  },
  {
    id: "streak-30",
    title: "Budget Warrior",
    description: "30 consecutive days with positive daily balance",
    icon: Flame,
    category: "streak",
    points: 150,
    rarity: "epic",
    compute: ({ transactions }) => {
      const streak = getConsecutiveDaysWithSavings(transactions);
      return {
        unlocked: streak >= 30,
        progress: Math.min(streak, 30),
        target: 30,
      };
    },
  },
  {
    id: "smart-spender",
    title: "Smart Spender",
    description: "Reduce expenses by 20% compared to previous month",
    icon: TrendingUp,
    category: "spending",
    points: 100,
    rarity: "rare",
    compute: ({ transactions }) => {
      const reduction = getMonthlyExpenseReduction(transactions);
      return {
        unlocked: reduction >= 20,
        progress: Math.max(Math.min(reduction, 20), 0),
        target: 20,
      };
    },
  },
  {
    id: "diverse-tracker",
    title: "Diverse Tracker",
    description: "Track transactions across 8 different categories",
    icon: Sparkles,
    category: "milestone",
    points: 60,
    rarity: "rare",
    compute: ({ transactions }) => {
      const cats = getUniqueCategories(transactions);
      return {
        unlocked: cats >= 8,
        progress: Math.min(cats, 8),
        target: 8,
      };
    },
  },
];

/* ───────── Config ───────── */

const rarityConfig = {
  common: {
    color: "text-muted-foreground",
    bg: "bg-muted/20",
    border: "border-muted",
    glow: "",
    gradientBar: "from-muted-foreground/50 to-muted-foreground/30",
  },
  rare: {
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    glow: "shadow-glow-sm",
    gradientBar: "from-primary to-primary/50",
  },
  epic: {
    color: "text-secondary",
    bg: "bg-secondary/10",
    border: "border-secondary/30",
    glow: "shadow-glow-secondary",
    gradientBar: "from-secondary to-secondary/50",
  },
  legendary: {
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
    glow: "shadow-glow-warning",
    gradientBar: "from-accent to-accent/50",
  },
};

function formatProgressValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

/* ───────── Components ───────── */

function AchievementCard({
  achievement,
  index,
  showPrerequisites,
  prerequisites = [],
}: {
  achievement: Achievement;
  index: number;
  showPrerequisites?: boolean;
  prerequisites?: string[];
}) {
  const config = rarityConfig[achievement.rarity];
  const Icon = achievement.icon;
  const progressPercentage = achievement.progress !== undefined && achievement.target
    ? Math.min(100, Math.max(0, (achievement.progress / achievement.target) * 100))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "glass-card rounded-2xl p-5 transition-all duration-300 relative overflow-hidden",
        achievement.unlocked ? "hover:glass-card-glow" : "opacity-75",
        config.glow
      )}
    >
      {!achievement.unlocked && (
        <div className="absolute top-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-lg bg-muted/90 border border-border">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      <div className={cn("absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 rounded-full", config.bg, config.border, "border-2")} />

      <div className="flex items-start gap-4">
        <div className={cn("p-3 rounded-xl border shrink-0", config.bg, config.border)}>
          <Icon className={cn("w-6 h-6", config.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className={cn("font-display text-lg font-semibold mb-1", achievement.unlocked ? "text-foreground" : "text-muted-foreground")}>
                {achievement.title}
              </h3>
              <p className="text-sm text-muted-foreground">{achievement.description}</p>
            </div>
            {achievement.unlocked && (
              <div className="shrink-0 ml-2">
                <CheckCircle className="w-5 h-5 text-success" />
              </div>
            )}
          </div>

          {/* Progress bar for in-progress or locked achievements */}
          {achievement.progress !== undefined && achievement.target !== undefined && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Progress</span>
                <span className="font-mono">
                  {formatProgressValue(achievement.progress)} / {formatProgressValue(achievement.target)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className={cn("h-full rounded-full bg-gradient-to-r", config.gradientBar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>
            </div>
          )}

          {achievement.unlocked && achievement.unlockedDate && (
            <p className="text-xs text-muted-foreground mt-2">
              Unlocked: {new Date(achievement.unlockedDate).toLocaleDateString("en-UG", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}

          {showPrerequisites && prerequisites.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Requires: {prerequisites.join(", ")}
            </p>
          )}

          <div className="flex items-center gap-2 mt-3">
            <Star className={cn("w-4 h-4", config.color)} />
            <span className={cn("font-mono text-sm font-bold", config.color)}>
              {achievement.points} pts
            </span>
            <span className="text-xs text-muted-foreground ml-auto capitalize">
              {achievement.rarity}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ───────── Main Page ───────── */

export default function Achievements() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [pods, setPods] = useState<BudgetPortRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const loadData = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive) return;
      if (userError || !userData.user) {
        setIsLoading(false);
        return;
      }
      const uid = userData.user.id;

      const [txRes, goalRes, podRes] = await Promise.all([
        supabase.from("transactions").select("id,amount,type,category,date").eq("user_id", uid).order("date", { ascending: true }),
        supabase.from("goals").select("id,name,target_amount,current_amount").eq("user_id", uid),
        supabase.from("flux_pods").select("id,name,allocated,spent").eq("user_id", uid),
      ]);
      if (!isActive) return;

      setTransactions((txRes.data ?? []) as Transaction[]);
      setGoals((goalRes.data ?? []) as GoalRow[]);
      setPods((podRes.data ?? []) as BudgetPortRow[]);
      setIsLoading(false);
    };
    loadData();
    return () => {
      isActive = false;
    };
  }, []);

  // Compute achievements from real data
  const achievements: Achievement[] = useMemo(() => {
    const data = { transactions, goals, pods };
    return ACHIEVEMENT_DEFS.map((def) => {
      const result = def.compute(data);
      return {
        id: def.id,
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        points: def.points,
        rarity: def.rarity,
        unlocked: result.unlocked,
        progress: result.progress,
        target: result.target,
        unlockedDate: result.unlockedDate,
      };
    });
  }, [transactions, goals, pods]);

  const totalPoints = achievements.filter((a) => a.unlocked).reduce((sum, a) => sum + a.points, 0);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const completionRate = achievements.length > 0 ? Math.min(100, (unlockedCount / achievements.length) * 100) : 0;

  // State-machine gamification
  const gamificationState = useMemo(() => {
    const dates = transactions.map((t) => t.date).filter(Boolean);
    const firstDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => new Date(d).getTime()))) : new Date();
    const daysActive = Math.ceil((Date.now() - firstDate.getTime()) / (24 * 60 * 60 * 1000));
    return computeGamificationState({
      totalPoints,
      goalsCompleted: goals.filter((g) => g.current_amount >= g.target_amount).length,
      goalsTotal: goals.length,
      budgetPortsCount: pods.length,
      transactionsCount: transactions.length,
      currentStreak: getConsecutiveDaysWithSavings(transactions),
      savingsAmount: getTotalSavings(transactions),
      achievementsUnlocked: unlockedCount,
      daysActive,
    });
  }, [totalPoints, goals, pods, transactions, unlockedCount]);

  // Level system: every 200 points = 1 level
  const level = Math.floor(totalPoints / 200) + 1;
  const pointsInLevel = totalPoints % 200;
  const nextLevelAt = 200;

  const unlockedAchievements = achievements.filter((a) => a.unlocked);
  const lockedAchievements = achievements.filter((a) => !a.unlocked);
  const unlockedIds = new Set(unlockedAchievements.map((a) => a.id));
  const nextAchievableIds = getNextAchievable(unlockedIds, achievements.map((a) => a.id));
  const nextAchievable = achievements.filter((a) => nextAchievableIds.includes(a.id));

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-warm flex items-center justify-center shadow-glow-warning">
                <Trophy className="w-6 h-6 text-accent-foreground" />
              </div>
              Achievements
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Track your financial milestones and earn rewards
            </p>
          </div>
        </motion.header>

        {isLoading && (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground animate-pulse">Loading your achievements...</p>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Gamification Tier (State Machine) */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "glass-card rounded-xl p-5 border-2",
                gamificationState.state === "legend" && "border-rose-500/50",
                gamificationState.state === "master" && "border-amber-500/50",
                gamificationState.state === "expert" && "border-purple-500/50",
                gamificationState.state === "adept" && "border-green-500/30",
                gamificationState.state === "learner" && "border-blue-500/30",
                gamificationState.state === "novice" && "border-border"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <span className="text-4xl">{gamificationState.definition.icon}</span>
                  <div>
                    <h2 className="font-display text-xl font-bold text-foreground">
                      {gamificationState.definition.label}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {gamificationState.definition.description}
                    </p>
                  </div>
                </div>
                {gamificationState.nextState && (
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Next: {gamificationState.nextState.label}</p>
                    <div className="h-2 w-24 bg-muted rounded-full overflow-hidden mt-1">
                      <motion.div
                        className="h-full bg-gradient-primary rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${gamificationState.progressToNext * 100}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {gamificationState.definition.rewards.map((r) => (
                  <span
                    key={r}
                    className="text-xs px-2 py-1 rounded bg-muted/50 text-muted-foreground"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Points</p>
                <p className="font-mono text-2xl font-bold text-accent">{totalPoints}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Unlocked</p>
                <p className="font-mono text-2xl font-bold text-success">
                  {unlockedCount}/{achievements.length}
                </p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Completion</p>
                <p className="font-mono text-2xl font-bold text-primary">
                  {completionRate.toFixed(0)}%
                </p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Level</p>
                <p className="font-mono text-2xl font-bold text-foreground">Level {level}</p>
                <p className="text-xs text-muted-foreground mt-1">{pointsInLevel}/{nextLevelAt} pts to next</p>
              </motion.div>
            </div>

            {/* Progress Bar */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="glass-card rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Overall Progress</span>
                <span className="text-sm font-mono text-muted-foreground">{completionRate.toFixed(1)}%</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${completionRate}%` }}
                  transition={{ duration: 1, delay: 0.5 }}
                />
              </div>
            </motion.div>

            {/* Next Achievable (DAG - prerequisites met) */}
            {nextAchievable.length > 0 && (
              <div className="mb-6">
                <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Next Up ({nextAchievable.length})
                </h2>
                <p className="text-sm text-muted-foreground mb-3">
                  You're close! These achievements are within reach.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {nextAchievable.slice(0, 4).map((achievement, index) => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      index={index}
                      showPrerequisites
                      prerequisites={getPrerequisites(achievement.id).map(
                        (id) => ACHIEVEMENT_DEFS.find((d) => d.id === id)?.title ?? id
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Unlocked Achievements */}
            {unlockedAchievements.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-success" />
                  Unlocked ({unlockedAchievements.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unlockedAchievements.map((achievement, index) => (
                    <AchievementCard key={achievement.id} achievement={achievement} index={index} />
                  ))}
                </div>
              </div>
            )}

            {/* Locked Achievements */}
            {lockedAchievements.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-muted-foreground" />
                  In Progress ({lockedAchievements.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lockedAchievements.map((achievement, index) => (
                    <AchievementCard
                      key={achievement.id}
                      achievement={achievement}
                      index={unlockedAchievements.length + index}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
