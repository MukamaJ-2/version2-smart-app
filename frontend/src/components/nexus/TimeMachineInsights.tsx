import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Plus,
  BarChart3,
  Target,
  PiggyBank,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Receipt,
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";

interface TimeMachineInsightsProps {
  simulatedMonths: number;
}

export function TimeMachineInsights({ simulatedMonths }: TimeMachineInsightsProps) {
  const isPast = simulatedMonths < 0;
  const isFuture = simulatedMonths > 0;
  const isNow = simulatedMonths === 0;

  const projectedDate = simulatedMonths >= 0
    ? addMonths(new Date(), simulatedMonths)
    : subMonths(new Date(), Math.abs(simulatedMonths));
  const formattedDate = format(projectedDate, "MMMM yyyy");

  const quickActions = [
    { icon: Plus, label: "Add money in or out", to: "/transactions", desc: "Record income or spending" },
    { icon: Receipt, label: "Scan a receipt", to: "/transactions", desc: "Fill in details from a photo" },
    { icon: BarChart3, label: "Charts & summaries", to: "/reports", desc: "See where money went" },
    { icon: Target, label: "Savings goals", to: "/goals", desc: "Track what you’re saving for" },
    { icon: PiggyBank, label: "Budgets", to: "/budget-ports", desc: "Needs, wants, and savings split" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl border border-border/50 bg-muted/20 min-w-0 overflow-hidden"
    >
      {isNow && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h4 className="font-display text-sm font-semibold text-foreground">Shortcuts</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Common tasks in one tap.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to + action.label}
                  to={action.to}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-lg border border-border/40",
                    "bg-background/60 hover:bg-primary/5 hover:border-primary/30 transition-colors",
                    "group min-h-[72px] sm:min-h-0 touch-manipulation"
                  )}
                >
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground text-center leading-tight">
                    {action.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden sm:block">
                    {action.desc}
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {(isFuture || isPast) && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className={cn("w-4 h-4", isPast ? "text-secondary" : "text-primary")} />
            <h4 className="font-display text-sm font-semibold text-foreground">
              {isPast ? "Past view" : "Future preview"}
            </h4>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            {isPast ? (
              <>Numbers as of <strong className="text-foreground">{formattedDate}</strong>. The money map and cards above match that time.</>
            ) : (
              <>A rough picture for <strong className="text-foreground">{formattedDate}</strong> from today’s habits. Move the slider to try other months.</>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Open reports
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link
              to="/goals"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Open goals
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </>
      )}
    </motion.div>
  );
}
