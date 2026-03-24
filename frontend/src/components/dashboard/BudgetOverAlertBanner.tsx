import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getOverBudgetPods, formatCurrency } from "@/lib/budget-alerts";

interface FluxPod {
  id: string;
  name: string;
  allocated: number;
  spent: number;
}

interface TransactionRow {
  category: string;
  amount: number;
  type: string;
}

export default function BudgetOverAlertBanner() {
  const [pods, setPods] = useState<FluxPod[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!isSupabaseConfigured) return;
      const { data: userData, error } = await supabase.auth.getUser();
      if (!isActive || error || !userData.user) return;
      setUserId(userData.user.id);
      const [podsRes, txRes] = await Promise.all([
        supabase.from("flux_pods").select("id,name,allocated,spent").eq("user_id", userData.user.id),
        supabase.from("transactions").select("category,amount,type").eq("user_id", userData.user.id),
      ]);
      if (!isActive) return;
      setPods((podsRes.data ?? []) as FluxPod[]);
      setTransactions((txRes.data ?? []) as TransactionRow[]);
    };
    load();
    return () => { isActive = false };
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const ch = supabase
      .channel("budget-over-banner")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flux_pods", filter: `user_id=eq.${userId}` },
        () => {
          supabase
            .from("flux_pods")
            .select("id,name,allocated,spent")
            .eq("user_id", userId)
            .then(({ data }) => setPods((data ?? []) as FluxPod[]));
        }
      )
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
    return () => supabase.removeChannel(ch);
  }, [userId]);

  const overPods = useMemo(() => getOverBudgetPods(pods, transactions), [pods, transactions]);

  if (overPods.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-destructive/20">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {overPods.length === 1
              ? `"${overPods[0].pod.name}" is over budget`
              : `${overPods.length} budgets are over limit`}
          </p>
          <p className="text-sm text-muted-foreground">
            {overPods
              .map((o) => `${o.pod.name}: ${formatCurrency(o.overBy)} over`)
              .join(" · ")}
          </p>
        </div>
      </div>
      <Link
        to="/budget-ports"
        className="shrink-0 text-sm font-medium text-primary hover:text-primary-glow hover:underline"
      >
        Review →
      </Link>
    </motion.div>
  );
}
