/**
 * Budget Allocation Model
 * Simulates a trained optimization model for intelligent budget allocation
 */

import type { TrainingTransaction } from "../training-data";
import { forecastSpending } from "./spending-forecaster";
import { trainedBudgetShares } from "./artifacts/budget-allocator";

export interface BudgetAllocation {
  category: string;
  suggestedAmount: number;
  confidence: number;
  reasoning: string;
  minAmount: number;
  maxAmount: number;
}

export interface AllocationRecommendation {
  allocations: BudgetAllocation[];
  totalSuggested: number;
  expectedSavings: number;
  riskAssessment: "low" | "medium" | "high";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Simulated trained optimization model for budget allocation
 * Uses historical spending + goals + income to suggest optimal allocations
 */
export function suggestBudgetAllocation(
  availableBudget: number,
  historicalTransactions: TrainingTransaction[],
  currentAllocations: Record<string, number>,
  monthlyIncome: number,
  activeGoals: Array<{ name: string; monthlyContribution: number }>
): AllocationRecommendation {
  // Calculate historical spending by category
  const categorySpending: Record<string, { total: number; count: number; avg: number }> = {};
  
  historicalTransactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      if (!categorySpending[tx.category]) {
        categorySpending[tx.category] = { total: 0, count: 0, avg: 0 };
      }
      categorySpending[tx.category].total += Math.abs(tx.amount);
      categorySpending[tx.category].count += 1;
    });
  
  Object.keys(categorySpending).forEach((cat) => {
    categorySpending[cat].avg = categorySpending[cat].total / categorySpending[cat].count;
  });
  
  // Calculate total monthly spending from history
  const dates = historicalTransactions.map((tx) => new Date(tx.date).getTime());
  const timeSpan = dates.length > 0 
    ? (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24) 
    : 30;
  const timeSpanDays = Math.max(timeSpan, 1);
  const monthlySpendingTotal = Object.values(categorySpending)
    .reduce((sum, cat) => sum + (cat.total / timeSpanDays) * 30, 0);
  
  // Calculate goal requirements
  const totalGoalContributions = activeGoals.reduce(
    (sum, goal) => sum + goal.monthlyContribution,
    0
  );
  
  // Calculate available for allocation (income - goals - buffer)
  const buffer = monthlyIncome * 0.1; // 10% buffer
  const computedAllocatable = Math.max(monthlyIncome - totalGoalContributions - buffer, 0);
  const allocatable = availableBudget > 0 ? Math.min(availableBudget, computedAllocatable) : computedAllocatable;
  
  // Generate suggestions (simulates optimization algorithm)
  const allocations: BudgetAllocation[] = [];
  const categories = Object.keys(categorySpending);
  const globalMonthlyAverage =
    categories.length > 0 ? monthlySpendingTotal / categories.length : 0;
  
  // Calculate proportional allocation based on historical spending
  if (categories.length === 0 && Object.keys(trainedBudgetShares).length > 0) {
    Object.entries(trainedBudgetShares).forEach(([category, share]) => {
      const suggestedAmount = allocatable * share;
      allocations.push({
        category,
        suggestedAmount: Math.round(suggestedAmount),
        confidence: 0.55,
        reasoning: `Based on trained budget shares for ${category}`,
        minAmount: Math.round(suggestedAmount * 0.75),
        maxAmount: Math.round(suggestedAmount * 1.4),
      });
    });
  }

  if (allocations.length === 0) {
    // Fall back to history-based allocation when available
    // Calculate proportional allocation based on historical spending
  categories.forEach((category) => {
    const historical = categorySpending[category];
    const historicalMonthly = (historical.total / timeSpanDays) * 30;
    const smoothingFactor = clamp(1 - historical.count / 8, 0.2, 0.7);
    const adjustedMonthly =
      globalMonthlyAverage > 0
        ? historicalMonthly * (1 - smoothingFactor) + globalMonthlyAverage * smoothingFactor
        : historicalMonthly;
    
    // Suggested amount based on adjusted monthly + conservative buffer
    const bufferFactor = historical.count < 5 ? 1.05 : 1.1;
    const suggestedAmount = adjustedMonthly * bufferFactor;
    
    // Confidence based on data quality
    const confidence = Math.min(
      0.45 + (historical.count / 12) * 0.35 + (timeSpanDays / 90) * 0.2,
      0.95
    ) * (1 - smoothingFactor * 0.3);
    
    // Reasoning
    let reasoning = `Based on your historical spending of ${Math.round(adjustedMonthly)} UGX/month`;
    if (historical.count < 5) {
      reasoning += " (limited data, using estimates)";
    }
    if (suggestedAmount > adjustedMonthly * 1.2) {
      reasoning += ". Increased by 10% for safety buffer.";
    }
    
    allocations.push({
      category,
      suggestedAmount: Math.round(suggestedAmount),
      confidence,
      reasoning,
      minAmount: Math.round(adjustedMonthly * 0.8),
      maxAmount: Math.round(adjustedMonthly * 1.5),
    });
  });
  }
  
  // Sort by suggested amount (descending)
  allocations.sort((a, b) => b.suggestedAmount - a.suggestedAmount);
  
  // Calculate total and adjust if needed
  const totalSuggested = allocations.reduce((sum, alloc) => sum + alloc.suggestedAmount, 0);
  
  // Scale if total exceeds available budget
  if (allocatable > 0 && totalSuggested > allocatable) {
    const scaleFactor = allocatable / totalSuggested;
    allocations.forEach((alloc) => {
      alloc.suggestedAmount = Math.round(alloc.suggestedAmount * scaleFactor);
      alloc.minAmount = Math.round(alloc.minAmount * scaleFactor);
      alloc.maxAmount = Math.round(alloc.maxAmount * scaleFactor);
    });
  }
  
  // Risk assessment
  const adjustedTotal = allocations.reduce((sum, alloc) => sum + alloc.suggestedAmount, 0);
  const utilizationRate = allocatable > 0 ? adjustedTotal / allocatable : 0;
  let riskAssessment: "low" | "medium" | "high" = "medium";
  if (utilizationRate > 0.95) {
    riskAssessment = "high";
  } else if (utilizationRate < 0.7) {
    riskAssessment = "low";
  }
  
  const expectedSavings = allocatable - adjustedTotal;
  
  return {
    allocations,
    totalSuggested: adjustedTotal,
    expectedSavings: Math.max(0, expectedSavings),
    riskAssessment,
  };
}

/**
 * Suggest allocation for a new pod
 */
export function suggestNewPodAllocation(
  podName: string,
  availableBudget: number,
  historicalTransactions: TrainingTransaction[],
  existingPods: Array<{ name: string; allocated: number }>
): BudgetAllocation | null {
  // Try to match pod name to category
  const nameLower = podName.toLowerCase();
  let matchedCategory = "";
  
  if (/entertainment|fun|leisure/i.test(nameLower)) matchedCategory = "Entertainment";
  else if (/dining|food|restaurant/i.test(nameLower)) matchedCategory = "Dining";
  else if (/transport|travel|commute/i.test(nameLower)) matchedCategory = "Transport";
  else if (/shopping|retail/i.test(nameLower)) matchedCategory = "Shopping";
  else if (/health|fitness|gym/i.test(nameLower)) matchedCategory = "Health";
  else if (/tech|software|subscription/i.test(nameLower)) matchedCategory = "Tech";
  else if (/essential|necessity|basic/i.test(nameLower)) matchedCategory = "Essentials";
  
  if (!matchedCategory) {
    // No match - suggest based on available budget and existing pods
    const avgPodSize = existingPods.length > 0
      ? existingPods.reduce((sum, pod) => sum + pod.allocated, 0) / existingPods.length
      : availableBudget * 0.15;
    
    return {
      category: "Custom",
      suggestedAmount: Math.round(avgPodSize),
      confidence: 0.5,
      reasoning: `Suggested from your other budgets (average about ${Math.round(avgPodSize)} UGX)`,
      minAmount: Math.round(avgPodSize * 0.5),
      maxAmount: Math.round(avgPodSize * 2),
    };
  }
  
  // Find historical spending for matched category
  const categoryTx = historicalTransactions.filter(
    (tx) => tx.category === matchedCategory && tx.type === "expense"
  );
  
  if (categoryTx.length === 0) {
    return {
      category: matchedCategory,
      suggestedAmount: Math.round(availableBudget * 0.1),
      confidence: 0.4,
      reasoning: `No historical data for ${matchedCategory}, suggesting 10% of available budget`,
      minAmount: Math.round(availableBudget * 0.05),
      maxAmount: Math.round(availableBudget * 0.2),
    };
  }
  
  const dates = categoryTx.map((tx) => new Date(tx.date).getTime());
  const timeSpan = dates.length > 0
    ? (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24)
    : 30;
  const timeSpanDays = Math.max(timeSpan, 1);
  const monthlySpending = (categoryTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0) / timeSpanDays) * 30;
  const suggested = monthlySpending * 1.15; // 15% buffer
  
  return {
    category: matchedCategory,
    suggestedAmount: Math.round(suggested),
    confidence: 0.75,
    reasoning: `Based on your historical ${matchedCategory} spending of ${Math.round(monthlySpending)} UGX/month`,
    minAmount: Math.round(monthlySpending * 0.8),
    maxAmount: Math.round(monthlySpending * 1.5),
  };
}

