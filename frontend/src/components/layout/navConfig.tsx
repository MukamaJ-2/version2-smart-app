import {
  LayoutDashboard,
  Wallet,
  Target,
  MessageSquare,
  BarChart3,
  Settings,
  PiggyBank,
  Trophy,
  type LucideIcon,
} from "lucide-react";

export const navItems: { icon: LucideIcon; label: string; path: string }[] = [
  { icon: LayoutDashboard, label: "Wallet Hub", path: "/dashboard" },
  { icon: Wallet, label: "Transactions", path: "/transactions" },
  { icon: PiggyBank, label: "Budget Ports", path: "/budget-ports" },
  { icon: Target, label: "Goals", path: "/goals" },
  { icon: MessageSquare, label: "AI Companion", path: "/companion" },
  { icon: BarChart3, label: "Reports", path: "/reports" },
  { icon: Trophy, label: "Achievements", path: "/achievements" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

/** Bottom bar items (first 4 + More). */
export const bottomNavItems = navItems.slice(0, 4);
/** Items shown in the "More" sheet on mobile. */
export const moreSheetNavItems = navItems.slice(4);
