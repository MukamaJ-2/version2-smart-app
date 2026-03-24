import { motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, Briefcase, Car, Coffee, ShoppingBag, Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  time: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RecentTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const loadTransactions = async () => {
      if (!isSupabaseConfigured) return;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive) return;
      if (userError || !userData.user) return;
      setUserId(userData.user.id);
      const { data } = await supabase
        .from("transactions")
        .select("id,description,amount,type,category,date,time")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      setTransactions((data ?? []) as Transaction[]);
    };
    loadTransactions();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel("recent-transactions")
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
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || "00:00"}`).getTime();
        const dateB = new Date(`${b.date}T${b.time || "00:00"}`).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [transactions]);

  const categoryIconMap: Record<string, typeof Coffee> = {
    Dining: Utensils,
    "Eating Out": Utensils,
    Coffee: Coffee,
    Shopping: ShoppingBag,
    Transport: Car,
    Income: ArrowDownLeft,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5"
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-sm font-bold text-foreground tracking-tight">Recent Activity</h3>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Latest transactions</p>
        </div>
        <Link
          to="/transactions"
          className="text-xs font-medium text-primary hover:text-primary-glow transition-colors"
        >
          View All →
        </Link>
      </div>

      <div className="space-y-2">
        {recentTransactions.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No transactions yet. Add your first entry to see activity here.
          </div>
        )}
        {recentTransactions.map((tx, index) => {
          const Icon =
            tx.type === "income"
              ? ArrowDownLeft
              : categoryIconMap[tx.category] || Briefcase;
          return (
          <Link key={tx.id} to="/transactions">
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + index * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-border/60 hover:bg-muted/20 transition-all group cursor-pointer"
            >
            <div
              className={cn(
                "p-2 rounded-lg transition-all group-hover:scale-105",
                tx.type === "income"
                  ? "bg-success/15 text-success border border-success/20"
                  : "bg-muted/50 text-muted-foreground border border-border/40"
              )}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {tx.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {tx.date} {tx.time}
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  "text-sm font-mono font-medium",
                  tx.type === "income" ? "text-success" : "text-foreground"
                )}
              >
                {tx.type === "income" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </p>
              <p className="text-xs text-muted-foreground">{tx.category}</p>
            </div>
          </motion.div>
          </Link>
        );
        })}
      </div>
    </motion.div>
  );
}
