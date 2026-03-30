import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { navSections } from "./navConfig";

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: "income" | "expense" }>>(
    []
  );
  const [userId, setUserId] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

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
        .select("id,amount,type")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      setTransactions((data ?? []) as Array<{ id: string; amount: number; type: "income" | "expense" }>);
    };
    loadTransactions();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel("sidebar-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = payload.new as { id: string; amount: number; type: "income" | "expense" };
            setTransactions((prev) => (prev.some((tx) => tx.id === created.id) ? prev : [...prev, created]));
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as { id: string; amount: number; type: "income" | "expense" };
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

  const healthScore = useMemo(() => {
    const income = transactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
    const expense = transactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + tx.amount, 0);
    if (income <= 0) return 0;
    const rate = Math.max(0, Math.min(1, (income - expense) / income));
    return Math.round(rate * 100);
  }, [transactions]);

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem("onboarding_completed");
      sessionStorage.removeItem("onboarding_just_completed");
    } catch {}
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    setTimeout(() => {
      navigate("/auth");
    }, 500);
  };

  return (
    <motion.aside
      initial={{ width: 280 }}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="hidden h-screen flex-col bg-sidebar border-r border-sidebar-border relative md:flex"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-sidebar-border">
        <motion.div
          className="flex items-center gap-3"
          animate={{ justifyContent: collapsed ? "center" : "flex-start" }}
        >
          <div className="w-10 h-10 rounded-md border-2 border-primary/80 bg-card flex items-center justify-center shadow-sm">
            <span className="font-display text-lg font-semibold text-primary leading-none">U</span>
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              <span className="font-display text-lg font-bold text-foreground">UniGuard Wallet</span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-[0.2em]">
                Personal finance
              </span>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto scrollbar-hide">
        {navSections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="space-y-1">
            {section.label && !collapsed && (
              <div className="px-3 py-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.label}
                </span>
              </div>
            )}
            {section.items.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <motion.div
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-md transition-colors duration-150 group relative",
                      isActive
                        ? "bg-primary/[0.08] text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                    )}
                    whileHover={{ x: collapsed ? 0 : 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeNav"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-primary rounded-r-sm"
                      />
                    )}
                    <item.icon className="w-5 h-5 shrink-0" strokeWidth={isActive ? 2.25 : 1.75} />
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm font-medium"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Health Score */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-3 mb-4 p-4 glass-card rounded-md border-border/80"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Savings score</span>
            <span className="font-mono text-lg font-bold text-success tabular-nums">{healthScore}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-success rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${healthScore}%` }}
              transition={{ duration: 1, delay: 0.5 }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {healthScore >= 75 ? "You’re keeping a lot of income" : healthScore >= 50 ? "You’re in a steady range" : "Try to spend less than you earn"}
          </p>
        </motion.div>
      )}

      {/* Logout Button */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-4">
        <motion.button
          onClick={handleLogout}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group",
            "text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive",
            collapsed && "justify-center"
          )}
          whileHover={{ x: collapsed ? 0 : 4 }}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm font-medium"
            >
              Logout
            </motion.span>
          )}
        </motion.button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-sidebar-accent border border-sidebar-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-primary/20 transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </motion.aside>
  );
}
