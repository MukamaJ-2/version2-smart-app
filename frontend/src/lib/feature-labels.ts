/**
 * User-visible names shared across navigation, pages, and the dashboard 3D map.
 * Import these instead of duplicating strings so labels stay in sync.
 */
export const FEATURE_LABELS = {
  home: "Home",
  budgets: "Budgets",
  moneyCoach: "Money coach",
  rewardsSection: "Rewards",
} as const;

/** Bottom nav: shorten long labels on small screens */
export function bottomNavShortLabel(fullLabel: string): string {
  if (fullLabel === FEATURE_LABELS.moneyCoach) return "Coach";
  return fullLabel;
}
