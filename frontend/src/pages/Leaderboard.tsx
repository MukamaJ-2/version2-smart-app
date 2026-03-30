import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Crown, Award, Users, Shield } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { privatizeLeaderboardEntry } from "@/lib/privacy/differential-privacy";

interface LeaderboardEntry {
  user_id: string;
  total_income: number;
  total_expenses: number;
  savings_rate: number;
  budget_adherence: number | null;
  budget_pods_count: number;
  leaderboard_score: number;
}

const rankIcons: Record<number, typeof Trophy> = {
  1: Crown,
  2: Medal,
  3: Award,
};

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setCurrentUserId(userData.user.id);

      const { data, error: viewError } = await supabase
        .from("savings_rates_anonymous")
        .select(
          "user_id, total_income, total_expenses, savings_rate, budget_adherence, budget_pods_count, leaderboard_score"
        )
        .order("leaderboard_score", { ascending: false })
        .limit(20);
      if (!isActive) return;
      if (viewError) {
        setError(viewError.message);
        setEntries([]);
      } else {
        const raw = (data ?? []) as LeaderboardEntry[];
        const privatized = raw.map((e) => {
          const p = privatizeLeaderboardEntry(e.total_income, e.total_expenses, e.savings_rate, 0.5, {
            budgetAdherence: e.budget_adherence,
            leaderboardScore: e.leaderboard_score,
          });
          return {
            ...e,
            total_income: p.totalIncome,
            total_expenses: p.totalExpenses,
            savings_rate: p.savingsRate,
            budget_adherence: p.budgetAdherence,
            leaderboard_score: p.leaderboardScore,
          };
        });
        setEntries(privatized);
      }
      setIsLoading(false);
    };
    loadData();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-warm flex items-center justify-center shadow-glow-warning">
                <Trophy className="w-6 h-6 text-accent-foreground" />
              </div>
              Leaderboard
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              See how you rank among fellow UniGuard users
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>Ranked by score: savings + budget discipline (anonymous)</span>
            <span className="flex items-center gap-1 text-xs" title="Differential privacy: values are slightly perturbed to protect individual privacy">
              <Shield className="w-3.5 h-3.5" />
              DP
            </span>
          </div>
        </motion.header>

        {isLoading && (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground animate-pulse">Loading leaderboard...</p>
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card rounded-xl p-6 border border-destructive/30 bg-destructive/5"
          >
            <p className="text-destructive font-medium">Could not load leaderboard</p>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Ensure the savings_rates_anonymous view exists in your Supabase project.
            </p>
          </motion.div>
        )}

        {!isLoading && !error && entries.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card rounded-xl p-12 text-center"
          >
            <Trophy className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h2 className="font-display text-lg font-semibold text-foreground mb-2">
              No rankings yet
            </h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Add income and expense transactions to appear on the leaderboard. Set budget ports to factor in
              staying within limits.
            </p>
          </motion.div>
        )}

        {!isLoading && !error && entries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            {entries.map((entry, index) => {
              const rank = index + 1;
              const isCurrentUser = entry.user_id === currentUserId;
              const RankIcon = rankIcons[rank];
              const scorePct = Math.round(entry.leaderboard_score * 100);
              const savingsRatePct = Math.round(entry.savings_rate * 100);
              const hasBudgetScore =
                entry.budget_adherence != null && entry.budget_pods_count > 0;
              const budgetPct = hasBudgetScore ? Math.round((entry.budget_adherence ?? 0) * 100) : null;
              return (
                <motion.div
                  key={entry.user_id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "glass-card rounded-xl p-4 flex items-center gap-4 transition-all",
                    isCurrentUser && "ring-2 ring-primary/50 bg-primary/5"
                  )}
                >
                  {/* Rank */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold",
                      rank <= 3
                        ? "bg-gradient-warm text-accent-foreground shadow-glow-warning"
                        : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {RankIcon ? (
                      <>
                        <RankIcon className="w-5 h-5" />
                        <span className="text-[10px]">#{rank}</span>
                      </>
                    ) : (
                      <span className="text-lg">#{rank}</span>
                    )}
                  </div>

                  {/* Anonymous label */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-semibold truncate",
                          isCurrentUser ? "text-primary" : "text-foreground"
                        )}
                      >
                        {isCurrentUser ? "You" : `Saver #${rank}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span>Income: {entry.total_income.toLocaleString()} UGX</span>
                      <span>Expenses: {entry.total_expenses.toLocaleString()} UGX</span>
                      {hasBudgetScore && (
                        <span>
                          On-budget: {budgetPct}% ({entry.budget_pods_count} port
                          {entry.budget_pods_count === 1 ? "" : "s"})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Composite score + savings */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="font-mono font-bold text-success">{scorePct}%</div>
                    <div className="text-xs text-muted-foreground">score</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      save {savingsRatePct}%
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
