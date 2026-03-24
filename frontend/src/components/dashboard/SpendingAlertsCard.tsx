import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getTypicalSpendByCategory } from "@/lib/ai/typical-spend";

interface Transaction {
  category: string;
  amount: number;
  type: string;
  date: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SpendingAlertsCard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!isSupabaseConfigured) return;
      const { data: userData, error } = await supabase.auth.getUser();
      if (!isActive || error || !userData.user) return;
      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const start = ninetyDaysAgo.toISOString().split("T")[0];
      const { data } = await supabase
        .from("transactions")
        .select("category,amount,type,date")
        .eq("user_id", userData.user.id)
        .gte("date", start)
        .eq("type", "expense");
      if (!isActive) return;
      setTransactions((data ?? []) as Transaction[]);
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  const alerts = useMemo(() => {
    if (transactions.length < 5) return { categoryDrift: [], missing: [] };

    const typical = getTypicalSpendByCategory(transactions);
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const thisMonthExpenses: Record<string, number> = {};
    const thisWeekExpenses: Record<string, number> = {};
    transactions.forEach((tx) => {
      const d = new Date(tx.date);
      const amt = Math.abs(tx.amount);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
        thisMonthExpenses[tx.category] = (thisMonthExpenses[tx.category] ?? 0) + amt;
      }
      if (d >= weekAgo) {
        thisWeekExpenses[tx.category] = (thisWeekExpenses[tx.category] ?? 0) + amt;
      }
    });

    const categoryDrift: { category: string; current: number; typical: number }[] = [];
    const missing: { category: string; current: number; typicalWeekly: number }[] = [];

    typical.forEach((t) => {
      const currentMonth = thisMonthExpenses[t.category] ?? 0;
      const typicalMonthly = t.typicalMonthly;
      if (typicalMonthly > 0 && currentMonth > typicalMonthly * 1.3) {
        categoryDrift.push({
          category: t.category,
          current: currentMonth,
          typical: typicalMonthly,
        });
      }

      const currentWeek = thisWeekExpenses[t.category] ?? 0;
      const typicalWeekly = typicalMonthly / 4;
      if (typicalWeekly > 5000 && currentWeek < typicalWeekly * 0.5) {
        missing.push({
          category: t.category,
          current: currentWeek,
          typicalWeekly,
        });
      }
    });

    return { categoryDrift, missing };
  }, [transactions]);

  const hasAlerts = alerts.categoryDrift.length > 0 || alerts.missing.length > 0;
  if (!hasAlerts) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm font-bold text-foreground tracking-tight">
          Spending alerts
        </h3>
        <Link
          to="/reports"
          className="text-xs font-medium text-primary hover:text-primary-glow transition-colors flex items-center gap-1"
        >
          Details <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {alerts.categoryDrift.slice(0, 3).map((a) => (
          <div
            key={`drift-${a.category}`}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-warning/10 border border-warning/20"
          >
            <TrendingUp className="w-3.5 h-3.5 text-warning shrink-0" />
            <p className="text-xs text-foreground">
              You&apos;re spending more in <strong>{a.category}</strong> than usual ({formatCurrency(a.current)} vs ~{formatCurrency(a.typical)}/mo) – worth reviewing.
            </p>
          </div>
        ))}
        {alerts.missing.slice(0, 2).map((a) => (
          <div
            key={`missing-${a.category}`}
            className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/30"
          >
            <TrendingDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <p className="text-xs text-foreground">
              You usually spend ~{formatCurrency(a.typicalWeekly)}/wk on <strong>{a.category}</strong>; this week&apos;s total is {formatCurrency(a.current)} – did you miss anything?
            </p>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
