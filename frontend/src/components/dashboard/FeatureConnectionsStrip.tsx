import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet,
  PiggyBank,
  Target,
  MessageSquare,
  BarChart3,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURE_CONNECTIONS } from "@/lib/feature-connections";

const ICONS: LucideIcon[] = [Wallet, PiggyBank, Target, MessageSquare, BarChart3, Zap];

export default function FeatureConnectionsStrip() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      aria-label="Quick links to main tools"
      className="rounded-2xl border border-border/60 bg-muted/20 px-3 py-3 sm:px-4 sm:py-3.5"
    >
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Jump to
        </span>
        <span className="hidden sm:inline text-[10px] text-muted-foreground/80 truncate">
          Same data everywhere — pick a tool
        </span>
      </div>
      <div
        className={cn(
          "flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory",
          "sm:flex-wrap sm:overflow-visible sm:pb-0"
        )}
      >
        {FEATURE_CONNECTIONS.map((item, i) => {
          const Icon = ICONS[i] ?? Wallet;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.hint}
              className={cn(
                "snap-start shrink-0 inline-flex items-center gap-2 rounded-xl border border-border/80",
                "bg-background/80 px-3 py-2 text-xs font-medium text-foreground",
                "hover:border-primary/40 hover:bg-primary/5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              )}
            >
              <Icon className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </motion.section>
  );
}
