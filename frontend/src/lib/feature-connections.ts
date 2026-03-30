import { FEATURE_LABELS } from "@/lib/feature-labels";

/**
 * Cross-feature links for the home “connections” strip and other lightweight navigation.
 * Keeps paths and copy in one place so the app feels connected without duplicating strings.
 */
export const FEATURE_CONNECTIONS = [
  {
    path: "/transactions",
    label: "Transactions",
    hint: "Log and review every movement",
  },
  {
    path: "/budget-ports",
    label: FEATURE_LABELS.budgets,
    hint: "Pods and spending limits",
  },
  {
    path: "/goals",
    label: "Goals",
    hint: "Targets and progress",
  },
  {
    path: "/companion",
    label: FEATURE_LABELS.moneyCoach,
    hint: "Chat and Smart Money analysis",
  },
  {
    path: "/reports",
    label: "Reports",
    hint: "Charts and exports",
  },
  {
    path: "/weekly-challenges",
    label: "This week",
    hint: "Bonus points from habits",
  },
] as const;

export type FeatureConnection = (typeof FEATURE_CONNECTIONS)[number];
