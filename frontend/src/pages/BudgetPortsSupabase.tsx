import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Plus,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  ArrowRightLeft,
  Settings,
  Sparkles,
  TrendingUp,
  Calculator,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { aiService } from "@/lib/ai/ai-service";
import type { TrainingTransaction } from "@/lib/ai/training-data";
import { Badge } from "@/components/ui/badge";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { addNotification } from "@/lib/notifications";
import { getOverBudgetPods, formatCurrency as formatBudgetCurrency } from "@/lib/budget-alerts";
import { getTypicalSpendByCategory, getBudgetSuggestionMessage } from "@/lib/ai/typical-spend";
import OptimizeBudgetDialog from "@/components/modals/OptimizeBudgetDialog";

interface FluxPod {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  status: "healthy" | "warning" | "critical";
  velocity: number; // days until depleted at current rate
  children?: FluxPod[];
}

interface FluxPodRow {
  id: string;
  name: string;
  allocated: number;
  spent: number;
  status: "healthy" | "warning" | "critical";
  velocity: number;
  children: FluxPod[] | null;
}

function mapFluxPodRow(row: FluxPodRow): FluxPod {
  return {
    id: row.id,
    name: row.name,
    allocated: row.allocated,
    spent: row.spent,
    status: row.status,
    velocity: row.velocity,
    children: row.children ?? undefined,
  };
}

const statusConfig = {
  healthy: {
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    gradient: "from-success to-success-glow",
    icon: CheckCircle,
    label: "Healthy",
  },
  warning: {
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    gradient: "from-warning to-accent-glow",
    icon: AlertTriangle,
    label: "Strained",
  },
  critical: {
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    gradient: "from-destructive to-destructive-glow",
    icon: AlertTriangle,
    label: "Critical",
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function ReallocateDialog({ 
  pod, 
  allPods, 
  open, 
  onOpenChange, 
  onReallocate,
  effectiveSpent,
}: { 
  pod: FluxPod; 
  allPods: FluxPod[];
  effectiveSpent?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReallocate: (fromPodId: string, toPodId: string, amount: number) => void;
}) {
  const [targetPodId, setTargetPodId] = useState("");
  const [amount, setAmount] = useState("");
  const availablePods = allPods.filter((p) => p.id !== pod.id);
  const spent = effectiveSpent ?? pod.spent;
  const available = pod.allocated - spent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPodId || !amount) return;

    const reallocateAmount = parseFloat(amount) || 0;
    if (reallocateAmount <= 0 || reallocateAmount > available) {
      toast({
        title: "Invalid amount",
        description: "Amount must be greater than 0 and not exceed available balance.",
        variant: "destructive",
      });
      return;
    }

    onReallocate(pod.id, targetPodId, reallocateAmount);
    setTargetPodId("");
    setAmount("");
    onOpenChange(false);
    toast({
      title: "Money moved",
      description: `${formatCurrency(reallocateAmount)} moved from "${pod.name}".`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border">
        <DialogHeader>
          <DialogTitle>Move money from {pod.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="target-pod">Move to budget</Label>
            <select
              id="target-pod"
              value={targetPodId}
              onChange={(e) => setTargetPodId(e.target.value)}
              className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1"
              required
            >
              <option value="">Choose a budget…</option>
              {availablePods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Available: {formatCurrency(p.allocated - (p.id === pod.id ? spent : p.spent))})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="reallocate-amount">Amount (UGX)</Label>
            <Input
              id="reallocate-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Max: ${formatCurrency(available)}`}
              className="bg-muted/30 border-border mt-1"
              required
              min="0"
              max={available}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Available: {formatCurrency(available)}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-primary hover:opacity-90">
              Move money
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ConfigureDialog({
  pod,
  effectiveSpent,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: {
  pod: FluxPod;
  effectiveSpent?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (podId: string, updates: Partial<FluxPod>) => void;
  onDelete?: (podId: string) => void;
}) {
  const [name, setName] = useState(pod.name);
  const [allocated, setAllocated] = useState(pod.allocated.toString());
  const spent = effectiveSpent ?? pod.spent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !allocated) return;

    const newAllocated = parseFloat(allocated) || 0;
    if (newAllocated < spent) {
      toast({
        title: "Invalid budget",
        description: "Budget cannot be less than amount already spent.",
        variant: "destructive",
      });
      return;
    }

    onUpdate(pod.id, {
      name,
      allocated: newAllocated,
    });
    onOpenChange(false);
    toast({
      title: "Budget updated",
      description: `"${name}" was saved.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border">
        <DialogHeader>
          <DialogTitle>Edit {pod.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pod-name">Budget name</Label>
            <Input
              id="pod-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted/30 border-border mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="pod-allocated">Amount for this budget (UGX)</Label>
            <Input
              id="pod-allocated"
              type="number"
              value={allocated}
              onChange={(e) => setAllocated(e.target.value)}
              className="bg-muted/30 border-border mt-1"
              required
              min={spent}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Current spent: {formatCurrency(spent)}
            </p>
          </div>
          <div className="flex justify-between">
            <div>
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (confirm(`Delete budget "${pod.name}"? This cannot be undone.`)) {
                      onDelete(pod.id);
                      onOpenChange(false);
                    }
                  }}
                >
                  Delete budget
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-gradient-primary hover:opacity-90">
                Save Changes
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function computeStatusFromSpent(allocated: number, spent: number): "healthy" | "warning" | "critical" {
  if (allocated <= 0) return "healthy";
  const pct = (spent / allocated) * 100;
  if (pct >= 100) return "critical";
  if (pct >= 80) return "warning";
  return "healthy";
}

function PodCard({ 
  pod, 
  index, 
  allPods,
  effectiveSpent,
  daysLeftFromForecast,
  onUpdate,
  onReallocate,
  onDelete,
}: { 
  pod: FluxPod; 
  index: number;
  allPods: FluxPod[];
  effectiveSpent?: number;
  daysLeftFromForecast?: number;
  onUpdate: (podId: string, updates: Partial<FluxPod>) => void;
  onReallocate: (fromPodId: string, toPodId: string, amount: number) => void;
  onDelete?: (podId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showReallocate, setShowReallocate] = useState(false);
  const [showConfigure, setShowConfigure] = useState(false);
  const spent = effectiveSpent ?? pod.spent;
  const status = computeStatusFromSpent(pod.allocated, spent);
  const config = statusConfig[status];
  const safeAllocated = pod.allocated > 0 ? pod.allocated : 1;
  const percentageRaw = (spent / safeAllocated) * 100;
  const percentage = Math.max(0, percentageRaw); // Can exceed 100 when over budget
  const remaining = pod.allocated - spent;
  const daysLeft = daysLeftFromForecast ?? pod.velocity;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className={cn(
        "glass-card rounded-2xl overflow-hidden transition-all duration-500",
        status === "healthy" && "breathing",
        status === "warning" && "breathing-fast",
        status === "critical" && "pulse-glow"
      )}
    >
      {/* Header */}
      <div
        className={cn("p-5 border-b", config.border)}
        onClick={() => pod.children && setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl border", config.bg, config.border)}>
              <Zap className={cn("w-5 h-5", config.color)} />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">{pod.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <config.icon className={cn("w-3 h-3", config.color)} />
                <span className={cn("text-xs", config.color)}>{config.label}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-xl font-bold text-foreground">
              {formatCurrency(remaining)}
            </p>
            <p className="text-xs text-muted-foreground">remaining</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="relative h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", config.gradient)}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 1, delay: 0.3 }}
          />
          {percentage > 100 && (
            <motion.div
              className="absolute inset-y-0 right-0 bg-destructive/50"
              initial={{ width: 0 }}
              animate={{ width: `${percentage - 100}%` }}
              transition={{ duration: 0.5, delay: 1 }}
            />
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between mt-3 text-sm">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              <span className="font-mono text-foreground">{formatCurrency(spent)}</span> spent
            </span>
            <span className="text-muted-foreground">
              of <span className="font-mono text-foreground">{formatCurrency(pod.allocated)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingDown className={cn("w-4 h-4", config.color)} />
            <span className={cn("font-mono text-sm", config.color)}>
              {Math.round(daysLeft)}d left
            </span>
            <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary/30 text-primary">
              <Sparkles className="w-3 h-3 mr-1" />
              Estimate
            </Badge>
          </div>
        </div>

        {/* Expand indicator */}
        {pod.children && (
          <div className="flex justify-center mt-3">
            <motion.div animate={{ rotate: expanded ? 90 : 0 }}>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </motion.div>
          </div>
        )}
      </div>

      {/* Children */}
      {pod.children && expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-border"
        >
          {pod.children.map((child) => {
            const childConfig = statusConfig[child.status];
            const childPercentageRaw = (child.spent / child.allocated) * 100;
            const childPercentage = Math.min(999, Math.max(0, childPercentageRaw));
            return (
              <div
                key={child.id}
                className="p-4 border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", childConfig.bg, childConfig.color)} />
                    <span className="text-sm font-medium text-foreground">{child.name}</span>
                  </div>
                  <span className={cn("text-xs font-mono", childConfig.color)}>
                    {childPercentage.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full bg-gradient-to-r", childConfig.gradient)}
                    style={{ width: `${Math.min(childPercentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                  <span>{formatCurrency(child.spent)}</span>
                  <span>{formatCurrency(child.allocated - child.spent)} left</span>
                </div>
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 p-3 bg-muted/20">
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex-1 text-muted-foreground hover:text-foreground"
          onClick={() => setShowReallocate(true)}
          disabled={remaining <= 0 || allPods.length <= 1}
        >
          <ArrowRightLeft className="w-4 h-4 mr-1" />
          Move money
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex-1 text-muted-foreground hover:text-foreground"
          onClick={() => setShowConfigure(true)}
        >
          <Settings className="w-4 h-4 mr-1" />
          Edit
        </Button>
      </div>

      {/* Dialogs */}
      <ReallocateDialog
        pod={pod}
        allPods={allPods}
        effectiveSpent={effectiveSpent}
        open={showReallocate}
        onOpenChange={setShowReallocate}
        onReallocate={onReallocate}
      />
      <ConfigureDialog
        pod={pod}
        effectiveSpent={effectiveSpent}
        open={showConfigure}
        onOpenChange={setShowConfigure}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />
    </motion.div>
  );
}

function NewPodDialog({
  onAdd,
  existingPods,
  availableBudget,
  transactions,
}: {
  onAdd: (pod: FluxPod) => void;
  existingPods: FluxPod[];
  availableBudget: number;
  transactions: Array<{ category: string; amount: number; type: string; date: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [allocated, setAllocated] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<{ amount: number; reasoning: string } | null>(null);

  // Get AI suggestion when name changes – prefer typical spend from transaction history when category matches
  useEffect(() => {
    if (name && name.length > 2) {
      const typical = getTypicalSpendByCategory(transactions);
      const nameLower = name.toLowerCase().trim();
      const match = typical.find(
        (t) =>
          t.category.toLowerCase().includes(nameLower) ||
          nameLower.includes(t.category.toLowerCase())
      );
      if (match) {
        setAiSuggestion({
          amount: match.suggestedBudget,
          reasoning: getBudgetSuggestionMessage(
            match.category,
            match.typicalMonthly,
            match.suggestedBudget
          ),
        });
        if (!allocated) setAllocated(match.suggestedBudget.toString());
        return;
      }
      const suggestion = aiService.suggestNewPodAllocation(
        name,
        availableBudget,
        existingPods.map((p) => ({ name: p.name, allocated: p.allocated }))
      );
      if (suggestion) {
        setAiSuggestion({
          amount: suggestion.suggestedAmount,
          reasoning: suggestion.reasoning,
        });
        if (!allocated) setAllocated(suggestion.suggestedAmount.toString());
      } else {
        setAiSuggestion(null);
      }
    } else {
      setAiSuggestion(null);
    }
  }, [name, existingPods, availableBudget, allocated, transactions]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !allocated) return;

    const newPod: FluxPod = {
      id: Date.now().toString(),
      name,
      allocated: parseFloat(allocated) || 0,
      spent: 0,
      status: "healthy",
      velocity: 30,
    };

    onAdd(newPod);
    setName("");
    setAllocated("");
    setAiSuggestion(null);
    setOpen(false);
    toast({
      title: "Budget created",
      description: `"${name}" is set to ${formatCurrency(newPod.allocated)}.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          Add budget
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border">
        <DialogHeader>
          <DialogTitle>Add a budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Entertainment, Dining"
              className="bg-muted/30 border-border mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="allocated">Amount for this budget (UGX)</Label>
            <Input
              id="allocated"
              type="number"
              value={allocated}
              onChange={(e) => setAllocated(e.target.value)}
              placeholder={formatCurrency(availableBudget)}
              className="bg-muted/30 border-border mt-1"
              required
              min="0"
            />
            {aiSuggestion && (
              <div className="mt-2 p-3 rounded-lg bg-primary/5 border border-primary/30">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary uppercase tracking-wider">Suggested amount</span>
                </div>
                <p className="text-sm text-foreground mb-2">{aiSuggestion.reasoning}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setAllocated(aiSuggestion.amount.toString())}
                >
                  Use Suggested: {formatCurrency(aiSuggestion.amount)}
                </Button>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-primary hover:opacity-90">
              Create budget
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function normalizeCategoryForMatch(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export default function BudgetPortsSupabase() {
  const [fluxPods, setFluxPods] = useState<FluxPod[]>([]);
  const [transactions, setTransactions] = useState<TrainingTransaction[]>([]);
  const [forecasts, setForecasts] = useState<Record<string, { daysLeft: number; trend: string }>>({});
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOptimizer, setShowOptimizer] = useState(false);

  const effectiveSpentByPodId = useMemo(() => {
    const out: Record<string, number> = {};
    const categoryTotals: Record<string, number> = {};
    transactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        const key = normalizeCategoryForMatch(tx.category);
        categoryTotals[key] = (categoryTotals[key] ?? 0) + tx.amount;
      });
    fluxPods.forEach((pod) => {
      const key = normalizeCategoryForMatch(pod.name);
      const fromTx = categoryTotals[key] ?? 0;
      out[pod.id] = pod.spent + fromTx;
    });
    return out;
  }, [fluxPods, transactions]);

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
      setUserId(userData.user.id);

      const { data: podData, error: podError } = await supabase
        .from("flux_pods")
        .select("id,name,allocated,spent,status,velocity,children,created_at")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true });
      if (!isActive) return;
      if (podError) {
        toast({
          title: "Couldn’t load budgets",
          description: podError.message,
          variant: "destructive",
        });
      } else {
        const mapped = (podData ?? []).map((pod) => mapFluxPodRow(pod as FluxPodRow));
        setFluxPods(mapped);
      }

      const { data: transactionData, error: txError } = await supabase
        .from("transactions")
        .select("description,amount,category,type,date")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      if (txError) {
        console.error("Failed to load transactions for flux pods", txError);
        setMonthlyIncome(0);
        setTransactions([]);
        aiService.initialize([], 0);
      } else {
        const trainingData = (transactionData ?? []) as TrainingTransaction[];
        setTransactions(trainingData);
        const incomeTotal = trainingData
          .filter((tx) => tx.type === "income")
          .reduce((sum, tx) => sum + tx.amount, 0);
        setMonthlyIncome(incomeTotal);
        aiService.initialize(trainingData, incomeTotal);
      }
      setIsLoading(false);
    };
    loadData();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel("flux-pods-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flux_pods", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = mapFluxPodRow(payload.new as FluxPodRow);
            setFluxPods((prev) => (prev.some((pod) => pod.id === created.id) ? prev : [...prev, created]));
          }
          if (payload.eventType === "UPDATE") {
            const updated = mapFluxPodRow(payload.new as FluxPodRow);
            setFluxPods((prev) => prev.map((pod) => (pod.id === updated.id ? updated : pod)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setFluxPods((prev) => prev.filter((pod) => pod.id !== removedId));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Re-fetch transactions when they change so effectiveSpent (and budget deduction) stays in sync
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel("flux-pods-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        () => {
          supabase
            .from("transactions")
            .select("description,amount,category,type,date")
            .eq("user_id", userId)
            .then(({ data, error }) => {
              if (!error && data) {
                setTransactions(data as TrainingTransaction[]);
                const incomeTotal = (data as TrainingTransaction[])
                  .filter((tx) => tx.type === "income")
                  .reduce((sum, tx) => sum + tx.amount, 0);
                aiService.initialize(data as TrainingTransaction[], incomeTotal);
              }
            });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Generate forecasts for each pod using effective spent (DB spent + transactions by category)
  useEffect(() => {
    const forecastMap: Record<string, { daysLeft: number; trend: string }> = {};
    fluxPods.forEach((pod) => {
      const spent = effectiveSpentByPodId[pod.id] ?? pod.spent;
      const forecast = aiService.forecastSpending(pod.name, pod.allocated, spent, 30);
      forecastMap[pod.id] = {
        daysLeft: forecast.daysUntilDepletion,
        trend: forecast.trend,
      };
    });
    setForecasts(forecastMap);
  }, [fluxPods, effectiveSpentByPodId]);

  // Pop up budget over-spending alerts when any category exceeds its allocated amount
  useEffect(() => {
    if (!userId || fluxPods.length === 0) return;
    const overPods = getOverBudgetPods(fluxPods, transactions);
    overPods.forEach(({ pod, effectiveSpent, overBy }) => {
      const notificationId = `budget-over-${pod.id}`;
      addNotification(
        {
          id: notificationId,
          type: "budget_over",
          title: `"${pod.name}" over budget`,
          message: `You’ve spent ${formatBudgetCurrency(effectiveSpent)} in “${pod.name}” but only planned ${formatBudgetCurrency(pod.allocated)} (${formatBudgetCurrency(overBy)} over). Move money between budgets or cut spending.`,
          createdAt: new Date().toISOString(),
        },
        userId
      );
    });
  }, [userId, fluxPods, transactions, effectiveSpentByPodId]);

  const handleAddPod = async (pod: FluxPod) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add budgets.",
        variant: "destructive",
      });
      return;
    }
    const { data, error } = await supabase
      .from("flux_pods")
      .insert({
        user_id: userId,
        name: pod.name,
        allocated: pod.allocated,
        spent: pod.spent,
        status: pod.status,
        velocity: pod.velocity,
        children: pod.children ?? null,
      })
      .select("id,name,allocated,spent,status,velocity,children")
      .single();
    if (error || !data) {
      toast({
        title: "Couldn’t add budget",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }
    const saved = mapFluxPodRow(data as FluxPodRow);
    setFluxPods((prev) => [...prev, saved]);
  };

  const handleDeletePod = async (podId: string) => {
    if (!userId) return;
    const { error } = await supabase
      .from("flux_pods")
      .delete()
      .eq("id", podId)
      .eq("user_id", userId);
    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setFluxPods((prev) => prev.filter((pod) => pod.id !== podId));
    toast({
      title: "Budget removed",
      description: "That budget was deleted.",
    });
  };

  const handleUpdatePod = async (podId: string, updates: Partial<FluxPod>) => {
    if (!userId) return;
    const { error } = await supabase
      .from("flux_pods")
      .update({
        name: updates.name,
        allocated: updates.allocated,
        spent: updates.spent,
        status: updates.status,
        velocity: updates.velocity,
        children: updates.children ?? null,
      })
      .eq("id", podId)
      .eq("user_id", userId);
    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setFluxPods((prev) =>
      prev.map((pod) => {
        if (pod.id === podId) {
          return { ...pod, ...updates };
        }
        // Also update children if parent is updated
        if (pod.children) {
          return {
            ...pod,
            children: pod.children.map((child) =>
              child.id === podId ? { ...child, ...updates } : child
            ),
          };
        }
        return pod;
      })
    );
  };

  const handleReallocate = async (fromPodId: string, toPodId: string, amount: number) => {
    if (!userId) return;
    setFluxPods((prev) =>
      prev.map((pod) => {
        if (pod.id === fromPodId) {
          // Reduce allocated amount from source pod
          return {
            ...pod,
            allocated: pod.allocated - amount,
          };
        }
        if (pod.id === toPodId) {
          // Increase allocated amount in target pod
          return {
            ...pod,
            allocated: pod.allocated + amount,
          };
        }
        // Check children
        if (pod.children) {
          return {
            ...pod,
            children: pod.children.map((child) => {
              if (child.id === fromPodId) {
                return { ...child, allocated: child.allocated - amount };
              }
              if (child.id === toPodId) {
                return { ...child, allocated: child.allocated + amount };
              }
              return child;
            }),
          };
        }
        return pod;
      })
    );
    const fromPod = fluxPods.find((pod) => pod.id === fromPodId);
    const toPod = fluxPods.find((pod) => pod.id === toPodId);
    if (fromPod) {
      await supabase
        .from("flux_pods")
        .update({ allocated: fromPod.allocated - amount })
        .eq("id", fromPodId)
        .eq("user_id", userId);
    }
    if (toPod) {
      await supabase
        .from("flux_pods")
        .update({ allocated: toPod.allocated + amount })
        .eq("id", toPodId)
        .eq("user_id", userId);
    }
  };

  const totalAllocated = fluxPods.reduce((sum, pod) => sum + pod.allocated, 0);
  const totalSpent = fluxPods.reduce(
    (sum, pod) => sum + (effectiveSpentByPodId[pod.id] ?? pod.spent),
    0
  );
  const healthyCount = fluxPods.filter(
    (p) => computeStatusFromSpent(p.allocated, effectiveSpentByPodId[p.id] ?? p.spent) === "healthy"
  ).length;
  const warningCount = fluxPods.filter(
    (p) => computeStatusFromSpent(p.allocated, effectiveSpentByPodId[p.id] ?? p.spent) === "warning"
  ).length;
  const criticalCount = fluxPods.filter(
    (p) => computeStatusFromSpent(p.allocated, effectiveSpentByPodId[p.id] ?? p.spent) === "critical"
  ).length;
  const availableBudget = Math.max(monthlyIncome - totalAllocated, 0);

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
            <h1 className="font-display text-2xl font-bold text-foreground">Budgets</h1>
            <p className="text-muted-foreground text-sm mt-1">Buckets for needs, wants, and savings</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-border hover:border-primary/50"
              onClick={() => setShowOptimizer(true)}
              disabled={fluxPods.length === 0 || monthlyIncome <= 0}
            >
              <Calculator className="w-4 h-4 mr-2" />
              Suggest split
            </Button>
            <NewPodDialog
            onAdd={handleAddPod}
            existingPods={fluxPods}
            availableBudget={availableBudget}
            transactions={transactions}
          />
          </div>
        </motion.header>

        <OptimizeBudgetDialog
          open={showOptimizer}
          onOpenChange={setShowOptimizer}
          fluxPods={fluxPods}
          monthlyIncome={monthlyIncome}
          transactions={transactions}
          onApply={async (allocations) => {
            for (const pod of fluxPods) {
              const amount = allocations[pod.name];
              if (amount != null && amount !== pod.allocated) {
                await handleUpdatePod(pod.id, { allocated: amount });
              }
            }
            toast({
              title: "Budgets updated",
              description: "Amounts were updated from the suggestion.",
            });
          }}
        />

        {isLoading && (
          <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
            Loading your budgets…
          </div>
        )}

        {/* Overview Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-4"
        >
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Allocated</p>
            <p className="font-mono text-xl font-bold text-foreground">{formatCurrency(totalAllocated)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Spent</p>
            <p className="font-mono text-xl font-bold text-foreground">{formatCurrency(totalSpent)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Budget health</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-success font-mono">{healthyCount} ✓</span>
              <span className="text-warning font-mono">{warningCount} ⚠</span>
              <span className="text-destructive font-mono">{criticalCount} ✗</span>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Remaining</p>
            <p className="font-mono text-xl font-bold text-success">{formatCurrency(totalAllocated - totalSpent)}</p>
          </div>
        </motion.div>

        {/* Budget cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {fluxPods.length === 0 && (
            <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
              No budgets yet. Add one to start tracking spending.
            </div>
          )}
          {fluxPods.map((pod, index) => (
            <PodCard
              key={pod.id}
              pod={pod}
              index={index}
              allPods={fluxPods}
              effectiveSpent={effectiveSpentByPodId[pod.id]}
              daysLeftFromForecast={forecasts[pod.id]?.daysLeft}
              onUpdate={handleUpdatePod}
              onReallocate={handleReallocate}
              onDelete={handleDeletePod}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
