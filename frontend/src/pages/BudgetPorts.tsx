import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowLeftRight,
  TrendingDown,
  Wallet,
  Bell,
  PiggyBank,
  ShoppingBag,
  Home,
  Sparkles,
  Info,
  X,
  RefreshCw,
} from "lucide-react";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import AddPodModal from "@/components/modals/AddPodModal";
import ReallocateModal from "@/components/modals/ReallocateModal";
import { useFinancialData, formatCurrency, BudgetPot } from "@/hooks/useFinancialData";
import { toast } from "sonner";

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    color: "text-success",
    bgColor: "bg-success/20",
    borderColor: "border-success/30",
    glowColor: "shadow-[0_0_20px_rgba(34,197,94,0.2)]",
    label: "On Track",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-warning",
    bgColor: "bg-warning/20",
    borderColor: "border-warning/30",
    glowColor: "shadow-[0_0_20px_rgba(245,158,11,0.2)]",
    label: "Caution",
  },
  critical: {
    icon: XCircle,
    color: "text-destructive",
    bgColor: "bg-destructive/20",
    borderColor: "border-destructive/30",
    glowColor: "shadow-[0_0_20px_rgba(239,68,68,0.2)]",
    label: "Over Budget",
  },
};

const categoryConfig = {
  needs: { label: "Needs", icon: Home, color: "text-primary", bgColor: "bg-primary/20", chartColor: "#00d4ff" },
  wants: { label: "Wants", icon: ShoppingBag, color: "text-secondary", bgColor: "bg-secondary/20", chartColor: "#a855f7" },
  savings: { label: "Savings", icon: PiggyBank, color: "text-success", bgColor: "bg-success/20", chartColor: "#22c55e" },
};

function PotCard({ pot, index, onReallocate }: { pot: BudgetPot; index: number; onReallocate: (pot: BudgetPot) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const config = statusConfig[pot.status];
  const StatusIcon = config.icon;
  const catConfig = categoryConfig[pot.category];
  const percentUsed = pot.allocated > 0 ? (pot.spent / pot.allocated) * 100 : 0;
  const remaining = pot.allocated - pot.spent;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className={`glass-card rounded-2xl p-5 border ${config.borderColor} ${config.glowColor} transition-all duration-300 hover:scale-[1.01]`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${catConfig.bgColor} flex items-center justify-center`}>
                <catConfig.icon className={`w-5 h-5 ${catConfig.color}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{pot.name}</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={`text-xs ${config.color} ${config.borderColor}`}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {config.label}
                  </Badge>
                  <Badge variant="secondary" className="text-xs capitalize">{pot.category}</Badge>
                  {pot.rollover > 0 && (
                    <Badge variant="outline" className="text-xs text-success border-success/30">
                      <RefreshCw className="w-3 h-3 mr-1" />
                      +{formatCurrency(pot.rollover)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className={`font-mono font-bold ${remaining >= 0 ? config.color : "text-destructive"}`}>
                {formatCurrency(remaining)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Spent: {formatCurrency(pot.spent)}</span>
              <span>Budget: {formatCurrency(pot.allocated)}{pot.rollover > 0 ? ` (+${formatCurrency(pot.rollover)} rollover)` : ""}</span>
            </div>
            <div className="relative">
              <Progress value={Math.min(percentUsed, 100)} className="h-2 bg-card" />
              {percentUsed > 100 && (
                <div className="absolute inset-0 bg-destructive/30 rounded-full animate-pulse" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingDown className="w-3 h-3" />
                <span>~{pot.velocity} days left</span>
              </div>
              <span className="text-xs font-mono text-muted-foreground">{percentUsed.toFixed(0)}% used</span>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/50">
            <Button variant="ghost" size="sm" onClick={() => onReallocate(pot)} className="flex-1">
              <ArrowLeftRight className="w-4 h-4 mr-1" />
              Reallocate
            </Button>
            {pot.children && pot.children.length > 0 && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {pot.children.length} sub-ports
                </Button>
              </CollapsibleTrigger>
            )}
          </div>

          {pot.children && (
            <CollapsibleContent>
              <div className="mt-4 space-y-3 pl-4 border-l-2 border-primary/20">
                {pot.children.map((child) => {
                  const childConfig = statusConfig[child.status];
                  const childPercent = child.allocated > 0 ? (child.spent / child.allocated) * 100 : 0;
                  return (
                    <div key={child.id} className="glass-card rounded-lg p-3 border border-border/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-foreground">{child.name}</span>
                        <span className={`text-xs font-mono ${childConfig.color}`}>
                          {formatCurrency(child.allocated - child.spent)} left
                        </span>
                      </div>
                      <Progress value={childPercent} className="h-1.5 bg-card" />
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          )}
        </div>
      </Collapsible>
    </motion.div>
  );
}

function BudgetRuleDonut({ breakdown }: { breakdown: ReturnType<ReturnType<typeof useFinancialData>["getBudgetRuleBreakdown"]> }) {
  const data = [
    { name: "Needs", value: breakdown.actual.needs.spent, target: breakdown.rule.needs * 100, color: categoryConfig.needs.chartColor },
    { name: "Wants", value: breakdown.actual.wants.spent, target: breakdown.rule.wants * 100, color: categoryConfig.wants.chartColor },
    { name: "Savings", value: breakdown.actual.savings.spent, target: breakdown.rule.savings * 100, color: categoryConfig.savings.chartColor },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">50 / 30 / 20 Rule</h3>
      </div>

      <div className="flex items-center gap-6">
        <div className="w-[180px] h-[180px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                formatter={(value: number) => formatCurrency(value)}
              />
            </RePieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="font-mono text-lg font-bold text-foreground">{formatCurrency(total)}</p>
            <p className="text-[10px] text-muted-foreground">Total Spent</p>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {data.map((item) => {
            const percent = total > 0 ? (item.value / breakdown.income) * 100 : 0;
            const isOver = percent > item.target + 5;
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-medium text-foreground">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${isOver ? "text-destructive" : "text-muted-foreground"}`}>
                      {percent.toFixed(0)}%
                    </span>
                    <span className="text-xs text-muted-foreground">/ {item.target}%</span>
                  </div>
                </div>
                <div className="h-1.5 bg-card rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((percent / item.target) * 100, 100)}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SmartAlertsPanel({ alerts }: { alerts: ReturnType<ReturnType<typeof useFinancialData>["getSmartAlerts"]> }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visibleAlerts = alerts.filter(a => !dismissed.includes(a.id)).slice(0, 5);

  if (visibleAlerts.length === 0) return null;

  const severityConfig = {
    info: { bg: "bg-primary/10", border: "border-primary/30", icon: Info, color: "text-primary" },
    warning: { bg: "bg-warning/10", border: "border-warning/30", icon: AlertTriangle, color: "text-warning" },
    critical: { bg: "bg-destructive/10", border: "border-destructive/30", icon: XCircle, color: "text-destructive" },
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-warning" />
        <h3 className="font-semibold text-foreground">Smart Alerts</h3>
        <Badge variant="secondary" className="text-xs">{visibleAlerts.length}</Badge>
      </div>
      <div className="space-y-2">
        <AnimatePresence>
          {visibleAlerts.map((alert) => {
            const cfg = severityConfig[alert.severity];
            const AlertIcon = cfg.icon;
            return (
              <motion.div
                key={alert.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10, height: 0 }}
                className={`flex items-start gap-3 p-3 rounded-xl border ${cfg.border} ${cfg.bg}`}
              >
                <AlertIcon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
                <button onClick={() => setDismissed(p => [...p, alert.id])} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function BudgetPots() {
  const { budgetPots, addBudgetPot, reallocatePods, getBudgetRuleBreakdown, getSmartAlerts, getDailySpendingLimit } = useFinancialData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReallocateModal, setShowReallocateModal] = useState(false);
  const [selectedPot, setSelectedPot] = useState<BudgetPot | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const breakdown = useMemo(() => getBudgetRuleBreakdown(), [getBudgetRuleBreakdown]);
  const alerts = useMemo(() => getSmartAlerts(), [getSmartAlerts]);
  const dailyLimit = useMemo(() => getDailySpendingLimit(), [getDailySpendingLimit]);

  const filteredPots = filterCategory === "all" ? budgetPots : budgetPots.filter(p => p.category === filterCategory);
  const totalAllocated = budgetPots.reduce((sum, pot) => sum + pot.allocated, 0);
  const totalSpent = budgetPots.reduce((sum, pot) => sum + pot.spent, 0);
  const totalRollover = budgetPots.reduce((sum, pot) => sum + pot.rollover, 0);
  const healthyCount = budgetPots.filter(p => p.status === "healthy").length;
  const warningCount = budgetPots.filter(p => p.status === "warning").length;
  const criticalCount = budgetPots.filter(p => p.status === "critical").length;

  const handleAddPot = (pot: Omit<BudgetPot, "id">) => {
    addBudgetPot(pot);
    toast.success("Budget Port created!");
    setShowAddModal(false);
  };

  const handleReallocate = (pot: BudgetPot) => {
    setSelectedPot(pot);
    setShowReallocateModal(true);
  };

  const handleReallocateSubmit = (fromId: string, toId: string, amount: number) => {
    reallocatePods(fromId, toId, amount);
    toast.success(`Reallocated ${formatCurrency(amount)}`);
    setShowReallocateModal(false);
    setSelectedPot(null);
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-6 space-y-6">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Budget Ports</h1>
            <p className="text-muted-foreground text-sm mt-1">Smart budgeting with the 50/30/20 rule</p>
          </div>
          <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Port
          </Button>
        </motion.header>

        {/* Overview Stats */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Budget</p>
                <p className="font-mono text-lg font-bold text-foreground">{formatCurrency(totalAllocated)}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Spent</p>
                <p className="font-mono text-lg font-bold text-foreground">{formatCurrency(totalSpent)}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Port Health</p>
            <div className="flex items-center gap-3">
              <span className="text-success font-mono flex items-center gap-1"><CheckCircle className="w-4 h-4" /> {healthyCount}</span>
              <span className="text-warning font-mono flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> {warningCount}</span>
              <span className="text-destructive font-mono flex items-center gap-1"><XCircle className="w-4 h-4" /> {criticalCount}</span>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
                <PiggyBank className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Remaining</p>
                <p className="font-mono text-lg font-bold text-success">{formatCurrency(totalAllocated - totalSpent)}</p>
              </div>
            </div>
          </div>
          <div className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Daily Limit</p>
                <p className="font-mono text-lg font-bold text-warning">{formatCurrency(dailyLimit)}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 50/30/20 Visual Breakdown + Smart Alerts */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <BudgetRuleDonut breakdown={breakdown} />
          <SmartAlertsPanel alerts={alerts} />
        </div>

        {/* Rollover Banner */}
        {totalRollover > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-xl p-4 border border-success/30 bg-success/5 flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-success" />
            <div>
              <p className="text-sm font-medium text-foreground">Rollover Bonus: {formatCurrency(totalRollover)}</p>
              <p className="text-xs text-muted-foreground">Unspent budget from last month carried forward across your ports</p>
            </div>
          </motion.div>
        )}

        {/* Filter Tabs */}
        <div className="flex items-center gap-2">
          {["all", "needs", "wants", "savings"].map((cat) => (
            <Button
              key={cat}
              variant={filterCategory === cat ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterCategory(cat)}
              className={filterCategory === cat ? "bg-gradient-primary" : ""}
            >
              {cat === "all" ? "All Ports" : `${cat.charAt(0).toUpperCase() + cat.slice(1)} ${cat === "needs" ? "(50%)" : cat === "wants" ? "(30%)" : "(20%)"}`}
            </Button>
          ))}
        </div>

        {/* Ports Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredPots.map((pot, index) => (
            <PotCard key={pot.id} pot={pot} index={index} onReallocate={handleReallocate} />
          ))}
        </div>
      </div>

      <AddPodModal open={showAddModal} onOpenChange={setShowAddModal} onAdd={handleAddPot} />
      <ReallocateModal
        open={showReallocateModal}
        onOpenChange={setShowReallocateModal}
        sourcePod={selectedPot}
        allPods={budgetPots}
        onReallocate={handleReallocateSubmit}
      />
    </AppLayout>
  );
}
