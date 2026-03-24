import { useMemo } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { getTypicalSpendByCategory, getBudgetSuggestionMessage } from "@/lib/ai/typical-spend";

interface Transaction {
  category: string;
  amount: number;
  type: string;
  date: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function TypicalSpendCard({
  transactions,
}: {
  transactions: Transaction[];
}) {
  const typicalSpend = useMemo(
    () => getTypicalSpendByCategory(transactions),
    [transactions]
  );

  const topCategories = typicalSpend.slice(0, 5);
  if (topCategories.length === 0) return null;

  const topSuggestion = topCategories[0];
  const suggestion = getBudgetSuggestionMessage(
    topSuggestion.category,
    topSuggestion.typicalMonthly,
    topSuggestion.suggestedBudget
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/15 border border-primary/20">
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground tracking-tight">
              What you usually spend
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              From your recent expenses
            </p>
          </div>
        </div>
        <Link
          to="/budget-ports"
          className="text-xs font-medium text-primary hover:text-primary-glow transition-colors flex items-center gap-1"
        >
          Adjust budgets <TrendingUp className="w-3 h-3" />
        </Link>
      </div>

      <div className="space-y-2">
        {topCategories.map((cat) => (
          <div
            key={cat.category}
            className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20"
          >
            <span className="text-sm font-medium text-foreground">{cat.category}</span>
            <div className="text-right">
              <span className="text-sm font-mono font-semibold text-foreground">
                {formatCurrency(cat.typicalMonthly)}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">/mo</span>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground pt-2 border-t border-border/50 mt-2">
          {suggestion}
        </p>
      </div>
    </motion.div>
  );
}
