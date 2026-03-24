import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ChevronRight, TrendingUp, TrendingDown, Tag, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { detectAnomalyWithModel } from "@/lib/ai/models/anomaly-detector";
import type { TrainingTransaction } from "@/lib/ai/training-data";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  time: string;
}

interface AnomalySummary {
  total: number;
  highSpend: number;
  lowSpend: number;
  firstTime: number;
  duplicate: number;
  sampleReasons: string[];
}

export default function AnomalySummaryCard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<AnomalySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      const { data: userData, error } = await supabase.auth.getUser();
      if (!isActive || error || !userData.user) {
        setIsLoading(false);
        return;
      }
      const now = new Date();
      const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const { data } = await supabase
        .from("transactions")
        .select("id,description,amount,type,category,date,time")
        .eq("user_id", userData.user.id)
        .gte("date", startOfMonth)
        .order("date", { ascending: false });
      if (!isActive) return;
      setTransactions((data ?? []) as Transaction[]);
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (transactions.length < 3) {
      setSummary(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const trainingData: TrainingTransaction[] = transactions.map((tx) => ({
        description: tx.description,
        amount: tx.amount,
        category: tx.category,
        type: tx.type,
        date: tx.date,
      }));
      // Check last 25 transactions to limit API calls
      const toCheck = transactions.slice(0, 25);
      const results = await Promise.all(
        toCheck.map((tx) => {
          const trainingTx: TrainingTransaction = {
            description: tx.description,
            amount: tx.amount,
            category: tx.category,
            type: tx.type,
            date: tx.date,
          };
          return detectAnomalyWithModel(trainingTx, trainingData).then((r) => ({ tx, result: r }));
        })
      );
      if (cancelled) return;
      const anomalies = results.filter((r) => r.result.isAnomaly);
      const highSpend = anomalies.filter((r) => r.result.insightType === "high_spend").length;
      const lowSpend = anomalies.filter((r) => r.result.insightType === "low_spend").length;
      const firstTime = anomalies.filter((r) => r.result.insightType === "first_time_category").length;
      const duplicate = anomalies.filter((r) => r.result.insightType === "possible_duplicate").length;
      const sampleReasons = anomalies.slice(0, 3).map((r) => r.result.reason);
      setSummary({
        total: anomalies.length,
        highSpend,
        lowSpend,
        firstTime,
        duplicate,
        sampleReasons,
      });
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [transactions]);

  if (isLoading || !summary || summary.total === 0) return null;

  const breakdown = [
    summary.highSpend > 0 && { label: "Unusually high", count: summary.highSpend, icon: TrendingUp },
    summary.lowSpend > 0 && { label: "Unusually low", count: summary.lowSpend, icon: TrendingDown },
    summary.firstTime > 0 && { label: "First-time category", count: summary.firstTime, icon: Tag },
    summary.duplicate > 0 && { label: "Possible duplicates", count: summary.duplicate, icon: Copy },
  ].filter(Boolean) as Array<{ label: string; count: number; icon: typeof TrendingUp }>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-warning/15 border border-warning/20">
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground tracking-tight">
              Spending that stood out
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {summary.total} unusual transaction{summary.total !== 1 ? "s" : ""} this month
            </p>
          </div>
        </div>
        <Link
          to="/transactions"
          className="text-xs font-medium text-primary hover:text-primary-glow transition-colors flex items-center gap-1"
        >
          Review <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {breakdown.map(({ label, count, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs">{label}</span>
            </div>
            <span className="text-xs font-medium text-foreground">{count}</span>
          </div>
        ))}
        {summary.sampleReasons.length > 0 && (
          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border/50 mt-2">
            {summary.sampleReasons[0]}
          </p>
        )}
      </div>
    </motion.div>
  );
}
