import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, CalendarClock, TrendingUp, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

/* ───────── Types ───────── */

interface Transaction {
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
}

interface RecurringItem {
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  frequency: "weekly" | "biweekly" | "monthly";
  occurrences: number;
  nextExpected: string; // ISO date
  confidence: number; // 0-1
}

interface PredictionItem {
  description: string;
  amount: number;
  category: string;
  expectedDate: string;
  daysUntil: number;
}

/* ───────── Detection Logic ───────── */

function detectRecurring(transactions: Transaction[]): RecurringItem[] {
  // Group by description (case insensitive, trimmed)
  const groups: Record<string, Transaction[]> = {};
  transactions.forEach((tx) => {
    const key = tx.description.toLowerCase().trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
  });

  const results: RecurringItem[] = [];

  for (const [, txs] of Object.entries(groups)) {
    if (txs.length < 2) continue;

    // Sort by date
    const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
    
    // Calculate intervals between occurrences (in days)
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const d1 = new Date(sorted[i - 1].date);
      const d2 = new Date(sorted[i].date);
      const diffDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) intervals.push(diffDays);
    }

    if (intervals.length === 0) continue;

    const avgInterval = intervals.reduce((s, d) => s + d, 0) / intervals.length;
    const stdDev = Math.sqrt(intervals.reduce((s, d) => s + Math.pow(d - avgInterval, 2), 0) / intervals.length);
    
    // Confidence based on consistency of intervals
    const consistency = stdDev > 0 ? Math.max(0, 1 - stdDev / avgInterval) : 1;

    // Only detect if reasonably consistent (confidence > 0.4) and appeared 2+ times
    if (consistency < 0.4) continue;

    let frequency: "weekly" | "biweekly" | "monthly";
    if (avgInterval <= 10) frequency = "weekly";
    else if (avgInterval <= 20) frequency = "biweekly";
    else frequency = "monthly";

    // Average amount
    const avgAmount = sorted.reduce((s, tx) => s + tx.amount, 0) / sorted.length;

    // Next expected date
    const lastDate = new Date(sorted[sorted.length - 1].date);
    const nextDate = new Date(lastDate);
    nextDate.setDate(nextDate.getDate() + Math.round(avgInterval));

    results.push({
      description: sorted[0].description,
      amount: Math.round(avgAmount),
      category: sorted[sorted.length - 1].category,
      type: sorted[0].type,
      frequency,
      occurrences: sorted.length,
      nextExpected: nextDate.toISOString().split("T")[0],
      confidence: Math.round(consistency * 100) / 100,
    });
  }

  // Sort by confidence then occurrences
  return results.sort((a, b) => b.confidence - a.confidence || b.occurrences - a.occurrences).slice(0, 8);
}

function generatePredictions(recurring: RecurringItem[]): PredictionItem[] {
  const now = new Date();
  const predictions: PredictionItem[] = [];

  for (const r of recurring) {
    if (r.type !== "expense") continue;
    const nextDate = new Date(r.nextExpected);
    const daysUntil = Math.round((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only show upcoming (within next 30 days)
    if (daysUntil >= 0 && daysUntil <= 30) {
      predictions.push({
        description: r.description,
        amount: r.amount,
        category: r.category,
        expectedDate: r.nextExpected,
        daysUntil,
      });
    }
  }

  return predictions.sort((a, b) => a.daysUntil - b.daysUntil);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

/* ───────── Component ───────── */

export function SmartPredictionsFeed() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

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

      const { data } = await supabase
        .from("transactions")
        .select("description,amount,type,category,date")
        .eq("user_id", userData.user.id)
        .order("date", { ascending: true });
      if (!isActive) return;

      setTransactions((data ?? []) as Transaction[]);
      setIsLoading(false);
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);
  const predictions = useMemo(() => generatePredictions(recurring), [recurring]);

  const displayedRecurring = showAll ? recurring : recurring.slice(0, 3);

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-4" />
        <div className="space-y-3">
          <div className="h-12 bg-muted rounded" />
          <div className="h-12 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (transactions.length < 5) return null; // Not enough data

  return (
    <div className="space-y-4">
      {/* Upcoming Predictions */}
      {predictions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-warning/15 border border-warning/20">
              <CalendarClock className="w-4 h-4 text-warning" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-foreground tracking-tight">
                Bills you may see soon
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">From your past spending</p>
            </div>
          </div>
          <div className="space-y-2">
            {predictions.slice(0, 5).map((p, i) => (
              <motion.div
                key={`${p.description}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground font-medium truncate">{p.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.daysUntil === 0
                      ? "Expected today"
                      : p.daysUntil === 1
                      ? "Expected tomorrow"
                      : `In ${p.daysUntil} days`}{" "}
                    · {p.category}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-destructive shrink-0 ml-2">
                  -{formatCurrency(p.amount)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Detected Recurring */}
      {recurring.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 rounded-xl bg-primary/15 border border-primary/20">
              <RefreshCw className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-foreground tracking-tight">
                Regular payments
              </h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {recurring.length} we noticed
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {displayedRecurring.map((r, i) => (
                <motion.div
                  key={r.description}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground font-medium truncate">{r.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{r.frequency}</span>
                      <span>·</span>
                      <span>{r.category}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        <Zap className="w-3 h-3" />
                        {Math.round(r.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <span className={cn(
                    "font-mono text-sm font-bold shrink-0 ml-2",
                    r.type === "income" ? "text-success" : "text-foreground"
                  )}>
                    {r.type === "income" ? "+" : "-"}{formatCurrency(r.amount)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {recurring.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? (
                <>Show less <ChevronUp className="w-3 h-3 ml-1" /></>
              ) : (
                <>Show {recurring.length - 3} more <ChevronDown className="w-3 h-3 ml-1" /></>
              )}
            </Button>
          )}
        </motion.div>
      )}
    </div>
  );
}
