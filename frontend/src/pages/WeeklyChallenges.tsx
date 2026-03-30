import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Zap, CheckCircle, CalendarClock, Gift } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  WEEKLY_CHALLENGE_DEFS,
  getCurrentWeekBounds,
  getWeekId,
  computeWeeklyChallenge,
  getClaimedPointsForWeek,
  claimWeeklyChallenge,
  getTotalWeeklyBonusPoints,
  type WeeklyTx,
} from "@/lib/gamification/weekly-challenges";

export default function WeeklyChallenges() {
  const [transactions, setTransactions] = useState<WeeklyTx[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
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
      const { data } = await supabase
        .from("transactions")
        .select("id,amount,type,category,date")
        .eq("user_id", userData.user.id)
        .order("date", { ascending: true });
      if (!isActive) return;
      setTransactions((data ?? []) as WeeklyTx[]);
      setIsLoading(false);
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  const bounds = useMemo(() => getCurrentWeekBounds(), []);
  const weekId = useMemo(() => getWeekId(bounds), [bounds]);

  const [claimed, setClaimed] = useState<Record<string, number>>(() =>
    getClaimedPointsForWeek(weekId)
  );

  useEffect(() => {
    setClaimed(getClaimedPointsForWeek(weekId));
  }, [weekId]);

  const weeklyBonusTotal = useMemo(() => getTotalWeeklyBonusPoints(), [claimed]);

  const rows = useMemo(() => {
    return WEEKLY_CHALLENGE_DEFS.map((def) => {
      const result = computeWeeklyChallenge(def, transactions, bounds.start, bounds.end);
      const claimedPts = claimed[def.id];
      return { def, result, claimedPts };
    });
  }, [transactions, bounds, claimed]);

  const formatRange = () => {
    const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const end = new Date(bounds.end);
    end.setDate(end.getDate() - 1);
    return `${bounds.start.toLocaleDateString("en-UG", opts)} – ${end.toLocaleDateString("en-UG", opts)}`;
  };

  const handleClaim = (challengeId: string, points: number) => {
    claimWeeklyChallenge(weekId, challengeId, points);
    setClaimed(getClaimedPointsForWeek(weekId));
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
        >
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-warm flex items-center justify-center shadow-glow-warning">
                <Zap className="w-6 h-6 text-accent-foreground" />
              </div>
              Weekly challenges
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Short quests that reset each Monday. Claim bonus points when you complete them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span>{formatRange()}</span>
          </div>
        </motion.header>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/achievements"
            className="text-sm text-primary hover:underline"
          >
            ← Achievements
          </Link>
          <Link
            to="/leaderboard"
            className="text-sm text-primary hover:underline"
          >
            Leaderboard
          </Link>
        </div>

        {!isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 flex flex-wrap items-center gap-4 border border-primary/20"
          >
            <Gift className="w-8 h-8 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Lifetime weekly bonus</p>
              <p className="font-mono text-2xl font-bold text-foreground">{weeklyBonusTotal} pts</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adds to your total points on the Achievements page
              </p>
            </div>
          </motion.div>
        )}

        {isLoading && (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground animate-pulse">Loading challenges...</p>
          </div>
        )}

        {!isLoading && (
          <div className="space-y-4">
            {rows.map(({ def, result, claimedPts }, index) => {
              const isClaimed = claimedPts != null;
              const canClaim = result.complete && !isClaimed;
              const pct =
                result.target > 0 ? Math.min(100, (result.progress / result.target) * 100) : 0;

              return (
                <motion.div
                  key={def.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className={cn(
                    "glass-card rounded-xl p-5 border",
                    isClaimed && "border-success/30 bg-success/5",
                    !isClaimed && result.complete && "border-primary/40",
                    !isClaimed && !result.complete && "border-border"
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-display text-lg font-semibold text-foreground">
                          {def.title}
                        </h2>
                        {isClaimed && (
                          <CheckCircle className="w-5 h-5 text-success shrink-0" aria-hidden />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{def.description}</p>
                      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={cn(
                            "h-full rounded-full",
                            result.complete ? "bg-success" : "bg-primary"
                          )}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 font-mono">
                        {result.progress} / {result.target}
                        {!result.complete && " · Keep going"}
                      </p>
                    </div>
                    <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                      <span className="text-sm font-mono font-semibold text-accent">
                        +{def.bonusPoints} pts
                      </span>
                      {canClaim && (
                        <Button size="sm" onClick={() => handleClaim(def.id, def.bonusPoints)}>
                          Claim bonus
                        </Button>
                      )}
                      {isClaimed && (
                        <span className="text-xs text-success font-medium">Claimed +{claimedPts} pts</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
