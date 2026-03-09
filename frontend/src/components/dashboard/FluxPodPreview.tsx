import { motion } from "framer-motion";
import { Zap, TrendingDown, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface FluxPod {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  status: "healthy" | "warning" | "critical";
}

const statusConfig = {
  healthy: {
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    icon: CheckCircle,
    animation: "breathing",
  },
  warning: {
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    icon: AlertTriangle,
    animation: "breathing-fast",
  },
  critical: {
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    icon: AlertTriangle,
    animation: "pulse-glow",
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function FluxPodPreview() {
  const [pods, setPods] = useState<FluxPod[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const loadPods = async () => {
      if (!isSupabaseConfigured) return;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive) return;
      if (userError || !userData.user) return;
      setUserId(userData.user.id);
      const { data } = await supabase
        .from("flux_pods")
        .select("id,name,allocated,spent,status")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true });
      if (!isActive) return;
      setPods((data ?? []) as FluxPod[]);
    };
    loadPods();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel("flux-pod-preview")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flux_pods", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = payload.new as FluxPod;
            setPods((prev) => (prev.some((pod) => pod.id === created.id) ? prev : [...prev, created]));
          }
          if (payload.eventType === "UPDATE") {
            const updated = payload.new as FluxPod;
            setPods((prev) => prev.map((pod) => (pod.id === updated.id ? updated : pod)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setPods((prev) => prev.filter((pod) => pod.id !== removedId));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const previewPods = useMemo(() => pods.slice(0, 4), [pods]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10 shadow-glow-sm">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-display text-sm font-semibold text-foreground">Budget Ports</h3>
        </div>
        <Link 
          to="/budget-ports"
          className="text-xs text-primary hover:text-primary-glow transition-colors"
        >
          View All →
        </Link>
      </div>

      <div className="space-y-3">
        {previewPods.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No pods yet. Create a pod to see it here.
          </div>
        )}
        {previewPods.map((pod) => {
          const config = statusConfig[pod.status];
          const percentage = (pod.spent / pod.allocated) * 100;
          const remaining = pod.allocated - pod.spent;

          return (
            <Link key={pod.id} to="/budget-ports">
            <motion.div
              className={cn(
                  "p-3 rounded-lg border transition-all duration-300 hover:scale-[1.02] cursor-pointer",
                config.bg,
                config.border,
                config.animation
              )}
              whileHover={{ x: 4 }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <config.icon className={cn("w-3.5 h-3.5", config.color)} />
                  <span className="text-sm font-medium text-foreground">{pod.name}</span>
                </div>
                <span className={cn("text-xs font-mono", config.color)}>
                  {percentage.toFixed(0)}%
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                <motion.div
                  className={cn(
                    "h-full rounded-full",
                    pod.status === "healthy" && "bg-gradient-success",
                    pod.status === "warning" && "bg-gradient-warm",
                    pod.status === "critical" && "bg-gradient-danger"
                  )}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(percentage, 100)}%` }}
                  transition={{ duration: 1, delay: 0.2 }}
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {formatCurrency(pod.spent)} spent
                </span>
                <span className={cn("font-mono", remaining > 0 ? "text-success" : "text-destructive")}>
                  {formatCurrency(remaining)} left
                </span>
              </div>
            </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.div>
  );
}
