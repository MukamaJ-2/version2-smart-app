import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Target,
  Plus,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  ChevronRight,
  Lightbulb,
  Calculator,
  PiggyBank,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { aiService } from "@/lib/ai/ai-service";
import type { TrainingTransaction } from "@/lib/ai/training-data";
import { Badge } from "@/components/ui/badge";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { OnboardingAnswers } from "@/lib/onboarding";
import { getSuggestedGoalNameFromSurvey, getPlannedExpenseGoalSuggestion } from "@/lib/onboarding";

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  status: "on-track" | "mild-pressure" | "critical";
  monthlyContribution: number;
  linkedPods: string[];
}

interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  status: "on-track" | "mild-pressure" | "critical";
  monthly_contribution: number;
  linked_pods: string[] | null;
}

function mapGoalRow(row: GoalRow): Goal {
  return {
    id: row.id,
    name: row.name,
    targetAmount: row.target_amount,
    currentAmount: row.current_amount,
    deadline: row.deadline,
    status: row.status,
    monthlyContribution: row.monthly_contribution,
    linkedPods: row.linked_pods ?? [],
  };
}

const statusConfig = {
  "on-track": {
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    gradient: "from-success to-success-glow",
    icon: CheckCircle,
    label: "On Track",
    orbitColor: "#22c55e",
  },
  "mild-pressure": {
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    gradient: "from-warning to-accent-glow",
    icon: AlertTriangle,
    label: "Mild Pressure",
    orbitColor: "#f59e0b",
  },
  critical: {
    color: "text-destructive",
    bg: "bg-destructive/10",
    border: "border-destructive/30",
    gradient: "from-destructive to-destructive-glow",
    icon: AlertTriangle,
    label: "Critical",
    orbitColor: "#ef4444",
  },
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function daysUntil(deadline: string): number {
  const target = new Date(deadline);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface SpendingCategory {
  category: string;
  monthlySpending: number;
  transactionCount: number;
  reductionPercentage: number;
  potentialSavings: number;
  daysSaved: number;
  monthsSaved: number;
}

function analyzeSpendingPatterns(goal: Goal, transactions: TrainingTransaction[]): SpendingCategory[] {
  // Calculate monthly spending by category from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date);
    return txDate >= thirtyDaysAgo && tx.type === "expense";
  });

  // Group by category and calculate monthly totals
  const categoryTotals: Record<string, { total: number; count: number }> = {};
  
  recentTransactions.forEach((tx) => {
    if (!categoryTotals[tx.category]) {
      categoryTotals[tx.category] = { total: 0, count: 0 };
    }
    categoryTotals[tx.category].total += tx.amount;
    categoryTotals[tx.category].count += 1;
  });

  // Estimate monthly spending (multiply by 30/days to normalize)
  const daysInPeriod = 30;
  const categories: SpendingCategory[] = [];

  Object.entries(categoryTotals).forEach(([category, data]) => {
    // Estimate monthly spending (assuming the period represents typical spending)
    const monthlySpending = (data.total / daysInPeriod) * 30;
    
    // Calculate different reduction scenarios
    const reductionPercentages = [10, 20, 30];
    let bestReduction = 0;
    let bestSavings = 0;
    let bestDaysSaved = 0;
    let bestMonthsSaved = 0;

    reductionPercentages.forEach((reduction) => {
      const savings = monthlySpending * (reduction / 100);
      const newMonthlyContribution = goal.monthlyContribution + savings;
      
      if (newMonthlyContribution > 0) {
        const remaining = goal.targetAmount - goal.currentAmount;
        const currentMonths = remaining / goal.monthlyContribution;
        const newMonths = remaining / newMonthlyContribution;
        const monthsSaved = currentMonths - newMonths;
        const daysSaved = monthsSaved * 30;

        if (daysSaved > bestDaysSaved) {
          bestReduction = reduction;
          bestSavings = savings;
          bestDaysSaved = daysSaved;
          bestMonthsSaved = monthsSaved;
        }
      }
    });

    if (bestSavings > 0 && bestDaysSaved > 0) {
      categories.push({
        category,
        monthlySpending,
        transactionCount: data.count,
        reductionPercentage: bestReduction,
        potentialSavings: bestSavings,
        daysSaved: Math.round(bestDaysSaved),
        monthsSaved: Math.round(bestMonthsSaved * 10) / 10,
      });
    }
  });

  // Sort by potential impact (days saved)
  return categories.sort((a, b) => b.daysSaved - a.daysSaved);
}

function AddContributionDialog({
  goal,
  onSave,
}: {
  goal: Goal;
  onSave: (newCurrentAmount: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount.replace(/,/g, "")) || 0;
    if (value < 0) return;
    onSave(goal.currentAmount + value);
    setAmount("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="flex-1 text-muted-foreground hover:text-foreground">
          <PiggyBank className="w-4 h-4 mr-1" />
          Add contribution
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border max-w-sm">
        <DialogHeader>
          <DialogTitle>Update progress: {goal.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Current: {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
          </p>
          <div>
            <Label htmlFor="contribution-amount">Amount to add (UGX)</Label>
            <Input
              id="contribution-amount"
              type="number"
              min={0}
              step={1000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WhatIfDialog({
  goal,
  transactions,
  onApply,
}: {
  goal: Goal;
  transactions: TrainingTransaction[];
  onApply: (goalId: string, newMonthlyContribution: number, addedSavings: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const spendingAnalysis = analyzeSpendingPatterns(goal, transactions);
  const topRecommendations = spendingAnalysis.slice(0, 3);

  const remaining = goal.targetAmount - goal.currentAmount;
  const safeTarget = goal.targetAmount > 0 ? goal.targetAmount : 1;
  const safeMonthly = goal.monthlyContribution > 0 ? goal.monthlyContribution : 1;
  const currentMonths = remaining / safeMonthly;
  const currentDays = currentMonths * 30;

  // Calculate best case scenario
  const totalPotentialSavings = topRecommendations.reduce(
    (sum, rec) => sum + rec.potentialSavings,
    0
  );
  const bestCaseMonthlyContribution = goal.monthlyContribution + totalPotentialSavings;
  const safeBestMonthly = bestCaseMonthlyContribution > 0 ? bestCaseMonthlyContribution : 1;
  const bestCaseMonths = remaining / safeBestMonthly;
  const bestCaseDays = bestCaseMonths * 30;
  const daysAccelerated = Math.max(0, currentDays - bestCaseDays);
  const monthsAccelerated = Math.max(0, currentMonths - bestCaseMonths);
  const progressFasterPct = currentDays > 0 && Number.isFinite(currentDays)
    ? (daysAccelerated / currentDays) * 100
    : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="w-4 h-4 mr-1" />
          What-if
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            What-if Analysis: {goal.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Status */}
          <div className="glass-card rounded-xl p-4 border border-border">
            <h3 className="text-sm font-semibold text-foreground mb-3">Current Status</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Progress</p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {Math.min(100, (goal.currentAmount / safeTarget) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Remaining Amount</p>
                <p className="font-mono text-lg font-bold text-foreground">
                  {formatCurrency(remaining)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Monthly Contribution</p>
                <p className="font-mono text-lg font-bold text-primary">
                  {formatCurrency(goal.monthlyContribution)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Estimated Completion</p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {Math.ceil(currentMonths)} months ({Math.ceil(currentDays)} days)
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Deadline</p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {daysUntil(goal.deadline)} days left
                </p>
              </div>
            </div>
            {goal.currentAmount === 0 && (
              <p className="text-xs text-muted-foreground mt-3">
                Use &quot;Update progress&quot; on the goal card to add contributions and see completion % increase.
              </p>
            )}
          </div>

          {/* Top Recommendations */}
          {topRecommendations.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-foreground">Top Recommendations</h3>
              </div>
              <div className="space-y-2">
                {topRecommendations.map((rec, index) => (
                  <div
                    key={rec.category}
                    className="glass-card rounded-lg p-4 border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                            #{index + 1}
                          </span>
                          <span className="font-medium text-foreground">{rec.category}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Reduce spending by {rec.reductionPercentage}% (Current:{" "}
                          {formatCurrency(rec.monthlySpending)}/month)
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Potential Savings</p>
                        <p className="font-mono text-sm font-bold text-success">
                          {formatCurrency(rec.potentialSavings)}/mo
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Time Saved</p>
                        <p className="font-mono text-sm font-bold text-primary">
                          {rec.daysSaved} days
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Months Saved</p>
                        <p className="font-mono text-sm font-bold text-accent">
                          {rec.monthsSaved.toFixed(1)} months
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Best Case Scenario */}
          {topRecommendations.length > 0 && (
            <div className="glass-card rounded-xl p-4 border-2 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Best Case Scenario</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                If you implement all top recommendations:
              </p>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Additional Monthly Savings</p>
                  <p className="font-mono text-lg font-bold text-success">
                    {formatCurrency(totalPotentialSavings)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">New Monthly Contribution</p>
                  <p className="font-mono text-lg font-bold text-primary">
                    {formatCurrency(bestCaseMonthlyContribution)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Time Accelerated</p>
                  <p className="font-mono text-lg font-bold text-accent">
                    {Math.ceil(daysAccelerated)} days
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">New Completion Time</p>
                  <p className="font-mono text-lg font-bold text-success">
                    {Math.ceil(bestCaseMonths)} months ({Math.ceil(bestCaseDays)} days)
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Progress Acceleration</span>
                  <span className="font-mono text-primary font-bold">
                    {progressFasterPct.toFixed(1)}% faster
                  </span>
                </div>
                <Progress
                  value={Math.min(100, progressFasterPct)}
                  className="h-2"
                />
              </div>
            </div>
          )}

          {/* All Categories Analysis */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">All Spending Categories</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {spendingAnalysis.length > 0 ? (
                spendingAnalysis.map((rec) => (
                  <div
                    key={rec.category}
                    className="flex items-center justify-between p-3 glass-card rounded-lg border border-border"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{rec.category}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(rec.monthlySpending)}/month • {rec.transactionCount}{" "}
                        transactions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">
                        Reduce by {rec.reductionPercentage}%
                      </p>
                      <p className="font-mono text-sm font-bold text-success">
                        Save {formatCurrency(rec.potentialSavings)}/mo
                      </p>
                      <p className="text-xs text-primary mt-1">
                        {rec.daysSaved} days faster
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No spending data available for analysis
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button
              className="bg-gradient-primary hover:opacity-90"
              onClick={() => {
                if (totalPotentialSavings <= 0) {
                  toast({
                    title: "No savings available",
                    description: "Add more spending data to generate actionable recommendations.",
                    variant: "destructive",
                  });
                  return;
                }
                onApply(goal.id, bestCaseMonthlyContribution, totalPotentialSavings);
                setOpen(false);
              }}
            >
              Apply Recommendations
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoalDetailsDialog({
  goal,
  aiPrediction,
  open,
  onOpenChange,
}: {
  goal: Goal;
  aiPrediction?: { probability: number; monthsToComplete: number; successLikelihood: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const config = statusConfig[goal.status];
  const safeTarget = goal.targetAmount > 0 ? goal.targetAmount : 1;
  const percentage = Math.min(100, (goal.currentAmount / safeTarget) * 100);
  const days = daysUntil(goal.deadline);
  const remaining = goal.targetAmount - goal.currentAmount;
  const monthsToDeadline = Math.max(0, days / 30);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className={cn("w-5 h-5", config.color)} />
            {goal.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="glass-card rounded-xl p-4 border border-border space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono font-bold text-foreground">
                {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
              </span>
            </div>
            <Progress value={percentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{percentage.toFixed(0)}% complete</span>
              <span>{formatCurrency(remaining)} remaining</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">Deadline</p>
              <p className="font-medium text-foreground">{new Date(goal.deadline).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Days left</p>
              <p className="font-medium text-foreground">{days}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Monthly contribution</p>
              <p className="font-mono font-medium text-foreground">{formatCurrency(goal.monthlyContribution)}/mo</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Status</p>
              <p className={config.color}>{config.label}</p>
            </div>
          </div>
          {monthsToDeadline > 0 && goal.monthlyContribution > 0 && (
            <p className="text-xs text-muted-foreground">
              At current rate: {formatCurrency(remaining)} ÷ {formatCurrency(goal.monthlyContribution)}/mo
              ≈ {Math.ceil(remaining / goal.monthlyContribution)} months to reach target.
            </p>
          )}
          {aiPrediction && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-xs font-medium text-primary mb-1">Success likelihood</p>
              <p className="text-sm text-foreground">{aiPrediction.successLikelihood}</p>
              <p className="text-xs text-muted-foreground mt-1">
                ~{Math.min(100, Math.max(0, Math.round((aiPrediction.probability ?? 0) * 100)))}% probability • ~{aiPrediction.monthsToComplete.toFixed(0)} months
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GoalOrbit({
  goal,
  index,
  aiPrediction,
  transactions,
  onApply,
  onUpdateProgress,
}: {
  goal: Goal;
  index: number;
  aiPrediction?: { probability: number; monthsToComplete: number; successLikelihood: string };
  transactions: TrainingTransaction[];
  onApply: (goalId: string, newMonthlyContribution: number, addedSavings: number) => void;
  onUpdateProgress: (goalId: string, newCurrentAmount: number) => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const config = statusConfig[goal.status];
  const safeTarget = goal.targetAmount > 0 ? goal.targetAmount : 1;
  const percentage = Math.min(100, (goal.currentAmount / safeTarget) * 100);
  const days = daysUntil(goal.deadline);
  const remaining = goal.targetAmount - goal.currentAmount;

  // Calculate SVG orbit
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // ---- Visual Countdown ----
  const totalDays = days;
  const countdownWeeks = Math.floor(totalDays / 7);
  const countdownDaysRemainder = totalDays % 7;
  const countdownMonths = Math.floor(totalDays / 30);

  // ---- Auto-Adjust Suggestion ----
  const monthsLeft = totalDays / 30;
  const requiredMonthly = monthsLeft > 0 ? remaining / monthsLeft : remaining;
  const needsBoost = remaining > 0 && goal.monthlyContribution > 0 && requiredMonthly > goal.monthlyContribution * 1.05;
  const boostPercentRaw = goal.monthlyContribution > 0
    ? ((requiredMonthly - goal.monthlyContribution) / goal.monthlyContribution) * 100
    : 0;
  const boostPercent = Math.min(999, Math.max(-99, Math.round(boostPercentRaw)));

  // Deadline urgency
  const isUrgent = totalDays <= 30 && remaining > 0;
  const isWarning = totalDays <= 90 && totalDays > 30 && remaining > 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.15 }}
      className="glass-card rounded-2xl p-6 hover:glass-card-glow transition-all duration-300 group"
    >
      <div className="flex items-start gap-5">
        {/* Orbit Ring */}
        <div className="relative w-28 h-28 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="6"
            />
            {/* Progress ring */}
            <motion.circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={config.orbitColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={strokeDasharray}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, delay: 0.3 }}
              style={{
                filter: `drop-shadow(0 0 8px ${config.orbitColor}80)`,
              }}
            />
          </svg>
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn("font-mono text-xl font-bold", config.color)}>
              {percentage.toFixed(0)}%
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              complete
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn("p-1.5 rounded-lg", config.bg)}>
              <Target className={cn("w-4 h-4", config.color)} />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground truncate">
              {goal.name}
            </h3>
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <config.icon className={cn("w-3.5 h-3.5", config.color)} />
            <span className={cn("text-sm", config.color)}>{config.label}</span>
            <span className="text-muted-foreground">&bull;</span>
            {aiPrediction && (
              <>
                <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary/30 text-primary">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {Math.min(100, Math.max(0, Math.round(aiPrediction.probability * 100)))}% success
                </Badge>
              </>
            )}
          </div>

          {/* Visual Countdown Timer */}
          {remaining > 0 && (
            <div className={cn(
              "rounded-lg px-3 py-2 mb-3 border",
              isUrgent ? "bg-destructive/5 border-destructive/20" : isWarning ? "bg-warning/5 border-warning/20" : "bg-muted/20 border-border/50"
            )}>
              <div className="flex items-center gap-2 mb-1">
                <Clock className={cn("w-3.5 h-3.5", isUrgent ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground")} />
                <span className={cn("text-[10px] uppercase tracking-wider font-bold", isUrgent ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground")}>
                  {isUrgent ? "Deadline approaching!" : "Time remaining"}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                {countdownMonths > 0 && (
                  <><span className="font-mono text-lg font-bold text-foreground">{countdownMonths}</span><span className="text-xs text-muted-foreground mr-1">mo</span></>
                )}
                <span className="font-mono text-lg font-bold text-foreground">{countdownMonths > 0 ? countdownDaysRemainder : countdownWeeks}</span>
                <span className="text-xs text-muted-foreground mr-1">{countdownMonths > 0 ? "days" : "wk"}</span>
                {countdownMonths === 0 && (
                  <><span className="font-mono text-lg font-bold text-foreground">{countdownDaysRemainder}</span><span className="text-xs text-muted-foreground">days</span></>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-mono text-foreground">
                {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining</span>
              <span className={cn("font-mono", config.color)}>{formatCurrency(remaining)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Monthly</span>
              <span className="font-mono text-foreground">{formatCurrency(goal.monthlyContribution)}/mo</span>
            </div>
          </div>

          {/* Auto-Adjust Suggestion */}
          {needsBoost && remaining > 0 && (
            <div className="mt-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-primary">Auto-Adjust Tip</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Increase to <span className="font-mono font-bold text-foreground">{formatCurrency(Math.ceil(requiredMonthly))}/mo</span>
                {" "}({boostPercent >= 0 ? "+" : ""}{boostPercent}%) to meet your deadline.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-5 pt-4 border-t border-border">
        <AddContributionDialog
          goal={goal}
          onSave={(newCurrent) => onUpdateProgress(goal.id, newCurrent)}
        />
        <WhatIfDialog
          goal={goal}
          transactions={transactions}
          onApply={onApply}
        />
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-muted-foreground hover:text-foreground"
          onClick={() => {
            if (needsBoost) {
              onApply(goal.id, Math.ceil(requiredMonthly), Math.ceil(requiredMonthly) - goal.monthlyContribution);
              toast({
                title: "Contribution adjusted!",
                description: `Monthly contribution for "${goal.name}" updated to ${formatCurrency(Math.ceil(requiredMonthly))}.`,
              });
            } else {
              const boostAmount = goal.monthlyContribution * 1.5;
              toast({
                title: "Boost Goal",
                description: `Increasing monthly contribution to ${formatCurrency(boostAmount)} would help you reach "${goal.name}" faster.`,
              });
            }
          }}
        >
          <TrendingUp className="w-4 h-4 mr-1" />
          {needsBoost ? "Auto-Adjust" : "Boost"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          onClick={() => setDetailsOpen(true)}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>
      <GoalDetailsDialog
        goal={goal}
        aiPrediction={aiPrediction}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </motion.div>
  );
}

function NewGoalDialog({
  onAdd,
  suggestedName,
  defaultOpen,
}: {
  onAdd: (goal: Goal) => void;
  suggestedName?: string | null;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");

  useEffect(() => {
    if (open && suggestedName && !name) {
      setName(suggestedName);
    }
  }, [open, suggestedName]);

  const handleOpenChange = (o: boolean) => {
    setOpen(o);
    if (!o) setName("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !targetAmount || !deadline || !monthlyContribution) return;

    const newGoal: Goal = {
      id: Date.now().toString(),
      name,
      targetAmount: parseFloat(targetAmount) || 0,
      currentAmount: 0,
      deadline,
      status: "on-track",
      monthlyContribution: parseFloat(monthlyContribution) || 0,
      linkedPods: [],
    };

    onAdd(newGoal);
    setName("");
    setTargetAmount("");
    setDeadline("");
    setMonthlyContribution("");
    setOpen(false);
    toast({
      title: "Goal created",
      description: `"${name}" has been created with a target of ${formatCurrency(newGoal.targetAmount)}.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="w-4 h-4 mr-2" />
          New Goal
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-card border-border">
        <DialogHeader>
          <DialogTitle>Create New Goal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="goal-name">Goal Name</Label>
            <Input
              id="goal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Emergency Fund, Vacation"
              className="bg-muted/30 border-border mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="target-amount">Target Amount (UGX)</Label>
            <Input
              id="target-amount"
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              placeholder="300000"
              className="bg-muted/30 border-border mt-1"
              required
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="bg-muted/30 border-border mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="monthly">Monthly Contribution (UGX)</Label>
            <Input
              id="monthly"
              type="number"
              value={monthlyContribution}
              onChange={(e) => setMonthlyContribution(e.target.value)}
              placeholder="25000"
              className="bg-muted/30 border-border mt-1"
              required
              min="0"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-primary hover:opacity-90">
              Create Goal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Goals() {
  const [searchParams, setSearchParams] = useSearchParams();
  const createFromUrl = searchParams.get("create");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [aiPredictions, setAiPredictions] = useState<Record<string, { probability: number; monthsToComplete: number; successLikelihood: string }>>({});
  const [trainingTransactions, setTrainingTransactions] = useState<TrainingTransaction[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [profileAnswers, setProfileAnswers] = useState<OnboardingAnswers | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, setCountdownTick] = useState(0);

  const suggestedGoalName =
    (createFromUrl && decodeURIComponent(createFromUrl)) ||
    (profileAnswers && (getSuggestedGoalNameFromSurvey(profileAnswers) || getPlannedExpenseGoalSuggestion(profileAnswers))) ||
    null;
  const openNewGoalByDefault = !!createFromUrl;

  useEffect(() => {
    const interval = setInterval(() => setCountdownTick((t) => t + 1), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

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
      const { data: goalData, error: goalError } = await supabase
        .from("goals")
        .select("id,name,target_amount,current_amount,deadline,status,monthly_contribution,linked_pods,created_at")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true });
      if (!isActive) return;
      if (goalError) {
        toast({
          title: "Failed to load goals",
          description: goalError.message,
          variant: "destructive",
        });
      } else {
        const mapped = (goalData ?? []).map((goal) => mapGoalRow(goal as GoalRow));
        setGoals(mapped);
      }

      const { data: transactionData, error: txError } = await supabase
        .from("transactions")
        .select("description,amount,category,type,date")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      if (txError) {
        console.error("Failed to load transactions for goals", txError);
        setTrainingTransactions([]);
        aiService.initialize([], 0);
      } else {
        const parsed = (transactionData ?? []) as TrainingTransaction[];
        setTrainingTransactions(parsed);
        const incomeTotal = parsed
          .filter((tx) => tx.type === "income")
          .reduce((sum, tx) => sum + tx.amount, 0);
        aiService.initialize(parsed, incomeTotal);
      }
      const { data: profileData } = await supabase
        .from("profiles")
        .select("onboarding_answers")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (!isActive) return;
      setProfileAnswers((profileData as { onboarding_answers?: OnboardingAnswers } | null)?.onboarding_answers ?? null);
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
      .channel("goals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "goals", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = mapGoalRow(payload.new as GoalRow);
            setGoals((prev) => (prev.some((goal) => goal.id === created.id) ? prev : [...prev, created]));
          }
          if (payload.eventType === "UPDATE") {
            const updated = mapGoalRow(payload.new as GoalRow);
            setGoals((prev) => prev.map((goal) => (goal.id === updated.id ? updated : goal)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setGoals((prev) => prev.filter((goal) => goal.id !== removedId));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Initialize AI service and generate predictions
  useEffect(() => {
    // Generate predictions for each goal
    const predictions: Record<string, { probability: number; monthsToComplete: number; successLikelihood: string }> = {};
    goals.forEach((goal) => {
      const prediction = aiService.predictGoal(
        {
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          monthlyContribution: goal.monthlyContribution,
          deadline: goal.deadline,
        },
        goals.map((g) => ({ monthlyContribution: g.monthlyContribution }))
      );
      
      predictions[goal.id] = {
        probability: prediction.completionProbability,
        monthsToComplete: prediction.monthsToComplete,
        successLikelihood: prediction.successLikelihood,
      };
    });
    setAiPredictions(predictions);
  }, [goals, trainingTransactions]);

  const handleAddGoal = async (goal: Goal) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add goals.",
        variant: "destructive",
      });
      return;
    }
    const { data, error } = await supabase
      .from("goals")
      .insert({
        user_id: userId,
        name: goal.name,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount,
        deadline: goal.deadline,
        status: goal.status,
        monthly_contribution: goal.monthlyContribution,
        linked_pods: goal.linkedPods,
      })
      .select("id,name,target_amount,current_amount,deadline,status,monthly_contribution,linked_pods")
      .single();
    if (error || !data) {
      toast({
        title: "Failed to add goal",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }
    const saved = mapGoalRow(data as GoalRow);
    setGoals((prev) => [...prev, saved]);
  };

  const handleApplyRecommendations = async (
    goalId: string,
    newMonthlyContribution: number,
    addedSavings: number
  ) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to apply recommendations.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("goals")
      .update({ monthly_contribution: newMonthlyContribution })
      .eq("id", goalId)
      .eq("user_id", userId);
    if (error) {
      toast({
        title: "Apply failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setGoals((prev) =>
      prev.map((goal) =>
        goal.id === goalId ? { ...goal, monthlyContribution: newMonthlyContribution } : goal
      )
    );
    toast({
      title: "Recommendations applied",
      description: `Monthly contribution increased by ${formatCurrency(addedSavings)}.`,
    });
  };

  const handleUpdateGoalProgress = async (goalId: string, newCurrentAmount: number) => {
    if (!userId) return;
    const clamped = Math.max(0, Math.min(newCurrentAmount, goals.find((g) => g.id === goalId)?.targetAmount ?? newCurrentAmount));
    const { error } = await supabase
      .from("goals")
      .update({ current_amount: clamped })
      .eq("id", goalId)
      .eq("user_id", userId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    setGoals((prev) =>
      prev.map((g) => (g.id === goalId ? { ...g, currentAmount: clamped } : g))
    );
    toast({ title: "Progress updated", description: formatCurrency(clamped) + " saved toward this goal." });
  };

  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const onTrackCount = goals.filter((g) => g.status === "on-track").length;

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
            <h1 className="font-display text-2xl font-bold text-foreground">Goals & Orbits</h1>
            <p className="text-muted-foreground text-sm mt-1">Track your financial milestones</p>
          </div>
          <NewGoalDialog
            onAdd={(goal) => {
              handleAddGoal(goal);
              setSearchParams((p) => {
                const next = new URLSearchParams(p);
                next.delete("create");
                return next;
              });
            }}
            suggestedName={suggestedGoalName}
            defaultOpen={openNewGoalByDefault}
          />
        </motion.header>

        {isLoading && (
          <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
            Loading your goals...
          </div>
        )}

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Goal Value</p>
            <p className="font-mono text-xl font-bold text-foreground">{formatCurrency(totalTarget)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Saved</p>
            <p className="font-mono text-xl font-bold text-success">{formatCurrency(totalCurrent)}</p>
          </div>
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Goals On Track</p>
            <p className="font-mono text-xl font-bold text-primary">
              {onTrackCount}/{goals.length}
            </p>
          </div>
        </motion.div>

        {/* Goals Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {goals.length === 0 && (
            <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
              No goals yet. Create your first goal to start tracking real progress.
            </div>
          )}
          {goals.map((goal, index) => (
            <GoalOrbit 
              key={goal.id} 
              goal={goal} 
              index={index} 
              aiPrediction={aiPredictions[goal.id]}
              transactions={trainingTransactions}
              onApply={handleApplyRecommendations}
              onUpdateProgress={handleUpdateGoalProgress}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
