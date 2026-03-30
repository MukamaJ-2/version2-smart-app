/**
 * Differential Privacy for Aggregate Statistics
 * Adds Laplace noise to protect individual user privacy when displaying
 * leaderboard or shared aggregates.
 */

/**
 * Laplace distribution sample: Lap(0, b)
 * PDF: (1/2b) * exp(-|x|/b)
 * For (epsilon, delta)-DP we use scale b = sensitivity / epsilon
 */
function sampleLaplace(scale: number): number {
  const u = Math.random() - 0.5;
  return scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
}

/**
 * Add Laplace noise to a value for epsilon-differential privacy.
 * @param value - raw value
 * @param sensitivity - max change in value from one user's data change
 * @param epsilon - privacy parameter (smaller = more private, noisier)
 */
export function addLaplaceNoise(value: number, sensitivity: number, epsilon = 0.5): number {
  const scale = sensitivity / epsilon;
  return value + sampleLaplace(scale);
}

const rateSensitivity = 0.1;

/**
 * Apply DP to leaderboard entry - rounds to reasonable precision
 */
export function privatizeLeaderboardEntry(
  totalIncome: number,
  totalExpenses: number,
  savingsRate: number,
  epsilon = 0.5,
  options?: {
    budgetAdherence?: number | null;
    leaderboardScore?: number;
  }
): {
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  budgetAdherence: number | null;
  leaderboardScore: number;
} {
  const incomeSensitivity = Math.max(totalIncome * 0.1, 100000);
  const expenseSensitivity = Math.max(totalExpenses * 0.1, 100000);
  const rawScore = options?.leaderboardScore ?? savingsRate;

  const noisySavings = Math.max(0, Math.min(1, addLaplaceNoise(savingsRate, rateSensitivity, epsilon)));
  const noisyScore = Math.max(0, Math.min(1, addLaplaceNoise(rawScore, rateSensitivity, epsilon)));
  const noisyBudget =
    options?.budgetAdherence != null && !Number.isNaN(options.budgetAdherence)
      ? Math.max(0, Math.min(1, addLaplaceNoise(options.budgetAdherence, rateSensitivity, epsilon)))
      : null;

  return {
    totalIncome: Math.round(Math.max(0, addLaplaceNoise(totalIncome, incomeSensitivity, epsilon) / 10000) * 10000),
    totalExpenses: Math.round(Math.max(0, addLaplaceNoise(totalExpenses, expenseSensitivity, epsilon) / 10000) * 10000),
    savingsRate: noisySavings,
    budgetAdherence: noisyBudget,
    leaderboardScore: noisyScore,
  };
}
