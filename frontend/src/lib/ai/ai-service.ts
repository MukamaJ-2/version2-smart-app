/**
 * AI Service Layer
 * Centralized service for all AI model predictions
 * This acts as the interface between the UI and trained models
 */

import { aiFetch } from "../api";
import { categorizeTransaction, type CategorizationResult } from "./models/transaction-categorizer";
import { forecastSpending, type SpendingForecast } from "./models/spending-forecaster";
import { suggestBudgetAllocation, suggestNewPodAllocation, type AllocationRecommendation, type BudgetAllocation } from "./models/budget-allocator";
import { predictGoalAchievement, type GoalPrediction } from "./models/goal-predictor";
import { detectAnomaly, type AnomalyResult } from "./models/anomaly-detector";
import { detectRecurringPatterns, type RecurringPattern } from "./models/recurring-detector";
import { optimizeBudget, type OptimizerInput, type OptimizerResult } from "./models/budget-optimizer";
import type { TrainingTransaction } from "./training-data";
import {
  computeInsightModelSignals,
  computeInsightModelSignalsAsync,
  type InsightModelSignals,
} from "./insightModelSignals";

export interface AIInsight {
  id: number;
  type: "positive" | "warning" | "info";
  message: string;
  action: string;
  /** In-app route for the action link (optional) */
  actionPath?: string;
}

/**
 * Main AI Service class
 * Provides unified interface for all AI predictions
 */
export class AIService {
  private historicalTransactions: TrainingTransaction[] = [];
  private monthlyIncome: number = 0;

  /**
   * Initialize AI service with user data
   */
  initialize(transactions: TrainingTransaction[], income: number) {
    this.historicalTransactions = transactions;
    this.monthlyIncome = income;
  }

  /** Get transactions for RAG retrieval (read-only) */
  getTransactions(): TrainingTransaction[] {
    return [...this.historicalTransactions];
  }

  /**
   * Categorize a transaction using trained model
   */
  categorizeTransaction(
    description: string,
    amount: number,
    merchant?: string,
    transactionType?: "income" | "expense"
  ): CategorizationResult {
    return categorizeTransaction(
      description,
      amount,
      merchant,
      this.historicalTransactions,
      transactionType
    );
  }

  /**
   * Forecast spending for a category
   */
  forecastSpending(
    category: string,
    allocated: number,
    spent: number,
    daysInPeriod: number = 30
  ): SpendingForecast {
    return forecastSpending(
      category,
      this.historicalTransactions,
      allocated,
      spent,
      daysInPeriod
    );
  }

  /**
   * Suggest budget allocation
   */
  suggestBudgetAllocation(
    availableBudget: number,
    currentAllocations: Record<string, number>,
    activeGoals: Array<{ name: string; monthlyContribution: number }>
  ): AllocationRecommendation {
    return suggestBudgetAllocation(
      availableBudget,
      this.historicalTransactions,
      currentAllocations,
      this.monthlyIncome,
      activeGoals
    );
  }

  /**
   * Suggest allocation for new pod
   */
  suggestNewPodAllocation(
    podName: string,
    availableBudget: number,
    existingPods: Array<{ name: string; allocated: number }>
  ): BudgetAllocation | null {
    return suggestNewPodAllocation(
      podName,
      availableBudget,
      this.historicalTransactions,
      existingPods
    );
  }

  /**
   * Predict goal achievement
   */
  predictGoal(
    goal: {
      name: string;
      targetAmount: number;
      currentAmount: number;
      monthlyContribution: number;
      deadline: string;
    },
    activeGoals: Array<{ monthlyContribution: number }>
  ): GoalPrediction {
    return predictGoalAchievement(
      goal,
      this.historicalTransactions,
      this.monthlyIncome,
      activeGoals
    );
  }

  /**
   * Detect anomalies in transaction
   */
  detectAnomaly(transaction: TrainingTransaction): AnomalyResult {
    return detectAnomaly(transaction, this.historicalTransactions);
  }

  /**
   * Detect recurring transactions (subscriptions, bills) via pattern mining
   */
  detectRecurringTransactions(
    transactions: Array<{ id: string; description: string; amount: number; category: string; type: string; date: string }>
  ): RecurringPattern[] {
    return detectRecurringPatterns(transactions);
  }

  /**
   * Constraint-based budget optimization
   */
  optimizeBudget(input: OptimizerInput): OptimizerResult {
    return optimizeBudget(input);
  }

  /**
   * Category quality + anomaly signals for insights, Smart Money, and Companion prompts.
   */
  getInsightModelSignals(): InsightModelSignals {
    return computeInsightModelSignals(this.historicalTransactions);
  }

  /** Blends local rules + RF batch (when API is up) for Companion and Reports. */
  async getInsightModelSignalsAsync(): Promise<InsightModelSignals> {
    return computeInsightModelSignalsAsync(this.historicalTransactions);
  }

  /**
   * Get AI insights for dashboard
   */
  getDashboardInsights() {
    // Analyze overall financial health
    const totalSpending = this.historicalTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalIncome = this.historicalTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const savingsRate = totalIncome > 0 ? (totalIncome - totalSpending) / totalIncome : 0;

    return {
      savingsRate: Math.round(savingsRate * 100),
      totalSpending,
      totalIncome,
      transactionCount: this.historicalTransactions.length,
      topCategories: this.getTopCategories(),
      modelSignals: this.getInsightModelSignals(),
    };
  }

  /** Same as {@link getDashboardInsights} but anomaly block uses RF + local blend when backend is reachable. */
  async getDashboardInsightsAsync() {
    const totalSpending = this.historicalTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const totalIncome = this.historicalTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);

    const savingsRate = totalIncome > 0 ? (totalIncome - totalSpending) / totalIncome : 0;

    return {
      savingsRate: Math.round(savingsRate * 100),
      totalSpending,
      totalIncome,
      transactionCount: this.historicalTransactions.length,
      topCategories: this.getTopCategories(),
      modelSignals: await this.getInsightModelSignalsAsync(),
    };
  }

  private getTopCategories(): Array<{ category: string; amount: number; percentage: number }> {
    const categoryTotals: Record<string, number> = {};
    let total = 0;

    this.historicalTransactions
      .filter((tx) => tx.type === "expense")
      .forEach((tx) => {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
        total += tx.amount;
      });

    return Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: total > 0 ? Math.min(100, Math.max(0, Math.round((amount / total) * 100))) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }

  /**
   * Simulate future financial state
   */
  public simulateFutureState(
    monthsIntoFuture: number,
    currentAllocations: Array<{ id: string; name: string; allocated: number; spent: number; category: string }>,
    currentGoals: Array<{ id: string; name: string; targetAmount: number; currentAmount: number; monthlyContribution: number; deadline: string }>,
    currentNetWorth: number
  ) {
    if (monthsIntoFuture === 0) {
      return {
        projectedNetWorth: currentNetWorth,
        projectedGoals: currentGoals.map(g => ({ ...g, projectedAmount: g.currentAmount })),
        projectedPods: currentAllocations.map(p => ({ ...p, projectedSpent: p.spent })),
      };
    }

    const daysIntoFuture = monthsIntoFuture * 30;

    // 1. Project Goals
    const activeGoalsForPrediction = currentGoals.map(g => ({ monthlyContribution: g.monthlyContribution }));
    const projectedGoals = currentGoals.map(goal => {
      const remainingAmount = goal.targetAmount - goal.currentAmount;
      if (remainingAmount <= 0) {
        return { ...goal, projectedAmount: goal.currentAmount };
      }

      // We'll use our own simplified projection first, then bound it by predictGoal if we want to be fancy,
      // but a straightforward linear projection based on simulated progress is often clearer for a time machine.
      const projectedAddition = goal.monthlyContribution * monthsIntoFuture;
      const newAmount = Math.min(goal.targetAmount, goal.currentAmount + projectedAddition);

      return {
        ...goal,
        projectedAmount: newAmount
      };
    });

    // 2. Project Pods (Expenses)
    // We use the forecaster to figure out monthly run-rate per pod, then multiply by months
    const projectedPods = currentAllocations.map(pod => {
      const forecast = this.forecastSpending(
        pod.category || pod.name, // Use category or name
        pod.allocated,
        pod.spent,
        30 // 1 month period
      );

      // forecast.predictedAmount is the expected spend per month
      const monthlySpend = forecast.predictedAmount;
      // Total projected spend over the future duration
      // Note: for a true "Time Machine", we might reset spent each month, but for visualization
      // we can show cumulative spend vs cumulative allocation, or just monthly run rate.
      // Let's assume we want to show the state IN that future month:
      // The allocated amount remains the same per month. The projected spent is the run-rate.
      const projectedSpent = monthlySpend;

      return {
        ...pod,
        projectedSpent,
      };
    });

    // 3. Project Net Worth
    // Net worth change = (Monthly Income - Monthly Total Expenses) * monthsIntoFuture
    const totalMonthlyProjectedExpenses = projectedPods.reduce((sum, pod) => sum + pod.projectedSpent, 0);
    const monthlyNetFlow = this.monthlyIncome - totalMonthlyProjectedExpenses;
    const projectedNetWorth = currentNetWorth + (monthlyNetFlow * monthsIntoFuture);

    return {
      projectedNetWorth,
      projectedGoals,
      projectedPods,
    };
  }

  /**
   * Extract itemized expenses from a photo/receipt using the Python backend API (DocTR OCR).
   */
  public async parseReceipt(file: File): Promise<{
    extractedText: string[];
    rawText: string;
    suggestedAmount: number;
  }> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await aiFetch("/api/v1/scan-receipt", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = (data as { error?: string })?.error ?? response.statusText;
        throw new Error(typeof msg === "string" ? msg : "Failed to parse receipt");
      }
      return data;
    } catch (error) {
      console.error("Receipt parsing error:", error);
      throw error;
    }
  }

  /**
   * Generate dynamic insights based on transaction history (local anomaly rules only).
   */
  public getReportInsights(): AIInsight[] {
    if (this.historicalTransactions.length === 0) return [];
    return this.buildReportInsightsWithSignals(this.getInsightModelSignals());
  }

  /** Insights with RF + local anomaly blend when the ML API is available. */
  public async getReportInsightsAsync(): Promise<AIInsight[]> {
    if (this.historicalTransactions.length === 0) return [];
    const signals = await this.getInsightModelSignalsAsync();
    return this.buildReportInsightsWithSignals(signals);
  }

  private buildReportInsightsWithSignals(signals: InsightModelSignals): AIInsight[] {
    const insights: AIInsight[] = [];
    let id = 1;

    if (signals.categoryQuality.expenseCount >= 3 && signals.categoryQuality.miscellaneousRatio >= 0.2) {
      const pct = Math.round(signals.categoryQuality.miscellaneousRatio * 100);
      insights.push({
        id: id++,
        type: signals.categoryQuality.miscellaneousRatio >= 0.35 ? "warning" : "info",
        message: `${pct}% of expenses are in Miscellaneous — ${signals.categoryQuality.miscellaneousRatio >= 0.35 ? "recategorize where you can so" : "clearer labels help"} trends and ML tips match reality.`,
        action: "Review categories",
        actionPath: "/transactions",
      });
    }

    if (signals.anomalySummary.flaggedCount >= 1) {
      insights.push({
        id: id++,
        type: signals.anomalySummary.highSeverityCount > 0 ? "warning" : "info",
        message:
          signals.anomalySummary.highSeverityCount > 0
            ? `${signals.anomalySummary.flaggedCount} recent expense(s) look unusual vs your history (${signals.anomalySummary.highSeverityCount} need a closer look).`
            : `${signals.anomalySummary.flaggedCount} recent expense(s) are somewhat off your usual pattern.`,
        action: "Review flagged items",
        actionPath: "/transactions",
      });
    }

    // Helper to group by month
    const monthlyStats = this.getMonthlyStats();
    const months = Object.keys(monthlyStats).sort((a, b) => {
      // Very basic sort for MMM YYYY format
      const dateA = new Date(a);
      const dateB = new Date(b);
      return dateA.getTime() - dateB.getTime();
    });
    
    if (months.length < 2) {
      insights.push({
        id: id++,
        type: "info",
        message: "Track your finances for another month to unlock trend insights!",
        action: "Add transactions",
      });
      return insights.slice(0, 6);
    }

    const latestMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];
    
    const latest = monthlyStats[latestMonth];
    const prev = monthlyStats[prevMonth];

    // 1. Savings Rate Insight
    const latestSavingsRate = latest.income > 0 ? (latest.income - latest.expenses) / latest.income : 0;
    const prevSavingsRate = prev.income > 0 ? (prev.income - prev.expenses) / prev.income : 0;
    const rateDiff = latestSavingsRate - prevSavingsRate;

    if (rateDiff > 0.02) {
      const pct = Math.min(100, Math.max(0, Math.round(rateDiff * 100)));
      insights.push({
        id: id++,
        type: "positive",
        message: `You kept more of your income this month than in ${prevMonth} (about ${pct}% more).`,
        action: "Nice — keep going",
        actionPath: "/dashboard",
      });
    } else if (rateDiff < -0.05) {
      const pct = Math.min(100, Math.max(0, Math.round(Math.abs(rateDiff) * 100)));
      insights.push({
        id: id++,
        type: "warning",
        message: `You saved less of your income this month (about ${pct}% less than before).`,
        action: "See transactions",
        actionPath: "/transactions",
      });
    }

    // 2. Category Variance Insight
    const categoryAverages = this.getCategoryAverages();
    const latestCategorySpend = latest.categories;

    for (const [category, amount] of Object.entries(latestCategorySpend)) {
      const avg = categoryAverages[category] || 0;
      if (avg > 0 && amount > avg * 1.25) {
        const pct = Math.min(999, Math.max(0, Math.round((amount / avg - 1) * 100)));
        insights.push({
          id: id++,
          type: "warning",
          message: `Spending on ${category} is ${pct}% higher than what you usually spend.`,
          action: `Check your ${category} budget`,
          actionPath: "/budget-ports",
        });
      }
    }

    // 3. Performance Streaks
    if (latest.expenses < latest.income && prev.expenses < prev.income) {
      insights.push({
        id: id++,
        type: "positive",
        message: "You spent less than you earned for two months in a row.",
        action: "See rewards",
        actionPath: "/achievements",
      });
    }

    // 4. Default Info
    if (insights.length < 3) {
      insights.push({
        id: id++,
        type: "info",
        message: "Things look steady — you could nudge your savings goals a bit higher if you want.",
        action: "Open savings goals",
        actionPath: "/goals",
      });
    }

    return insights.slice(0, 6);
  }

  private getMonthlyStats() {
    const stats: Record<string, { income: number; expenses: number; categories: Record<string, number> }> = {};
    
    this.historicalTransactions.forEach(tx => {
      const date = new Date(tx.date);
      // Format as "MMM YYYY" for uniqueness
      const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      if (!stats[monthKey]) {
        stats[monthKey] = { income: 0, expenses: 0, categories: {} };
      }
      
      if (tx.type === "income") {
        stats[monthKey].income += tx.amount;
      } else {
        stats[monthKey].expenses += tx.amount;
        stats[monthKey].categories[tx.category] = (stats[monthKey].categories[tx.category] || 0) + tx.amount;
      }
    });
    
    return stats;
  }

  private getCategoryAverages() {
    const categoryTotals: Record<string, number> = {};
    const categoryMonths: Record<string, Set<string>> = {};
    
    this.historicalTransactions.forEach(tx => {
      if (tx.type === "expense") {
        const date = new Date(tx.date);
        const monthKey = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
        if (!categoryMonths[tx.category]) categoryMonths[tx.category] = new Set();
        categoryMonths[tx.category].add(monthKey);
      }
    });
    
    const averages: Record<string, number> = {};
    for (const category in categoryTotals) {
      averages[category] = categoryTotals[category] / categoryMonths[category].size;
    }
    return averages;
  }
}

// Export singleton instance
export const aiService = new AIService();

