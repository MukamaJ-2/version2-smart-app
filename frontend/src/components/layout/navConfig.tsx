import {
  LayoutDashboard,
  Wallet,
  Target,
  MessageSquare,
  BarChart3,
  Settings,
  PiggyBank,
  Trophy,
  Users,
  Vault,
  TrendingUp,
  Medal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FEATURE_LABELS } from "@/lib/feature-labels";

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
}

export interface NavSection {
  label?: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    items: [
      { icon: LayoutDashboard, label: FEATURE_LABELS.home, path: "/dashboard" },
      { icon: Wallet, label: "Transactions", path: "/transactions" },
      { icon: PiggyBank, label: FEATURE_LABELS.budgets, path: "/budget-ports" },
      { icon: Target, label: "Goals", path: "/goals" },
      { icon: MessageSquare, label: FEATURE_LABELS.moneyCoach, path: "/companion" },
      { icon: BarChart3, label: "Reports", path: "/reports" },
      { icon: Vault, label: "Savings Vault", path: "/savings-vault" },
      { icon: Users, label: "Family", path: "/family-finance" },
      { icon: TrendingUp, label: "Investments", path: "/investments" },
    ],
  },
  {
    label: FEATURE_LABELS.rewardsSection,
    items: [
      { icon: Trophy, label: "Achievements", path: "/achievements" },
      { icon: Zap, label: "Weekly challenges", path: "/weekly-challenges" },
      { icon: Medal, label: "Leaderboard", path: "/leaderboard" },
    ],
  },
  {
    items: [{ icon: Settings, label: "Settings", path: "/settings" }],
  },
];

/** Flat list of all nav items (for bottom nav, more sheet). */
export const navItems: NavItem[] = navSections.flatMap((s) => s.items);

/** Bottom bar items (first 4 + More). */
export const bottomNavItems = navItems.slice(0, 4);
/** Items shown in the "More" sheet on mobile. */
export const moreSheetNavItems = navItems.slice(4);
