/**
 * AI Service Layer
 * Centralized service for all AI model predictions
 * This acts as the interface between the UI and trained models
 */

import { categorizeTransaction, type CategorizationResult } from "./models/transaction-categorizer";
import { forecastSpending, type SpendingForecast } from "./models/spending-forecaster";
import { suggestBudgetAllocation, suggestNewPodAllocation, type AllocationRecommendation, type BudgetAllocation } from "./models/budget-allocator";
import { predictGoalAchievement, type GoalPrediction } from "./models/goal-predictor";
import { detectAnomaly, type AnomalyResult } from "./models/anomaly-detector";
import type { TrainingTransaction } from "./training-data";

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
        percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
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
   * Extract itemized expenses from a photo/receipt using the Python backend API (Donut).
   */
  public async parseReceipt(file: File): Promise<{
    merchant: string;
    totalAmount: number;
    date: string;
    items: Array<{ description: string; amount: number; category: string }>;
  }> {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://127.0.0.1:5000/api/v1/scan-receipt", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to parse receipt: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Receipt parsing error:", error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiService = new AIService();

