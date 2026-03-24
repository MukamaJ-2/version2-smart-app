import { useMemo } from "react";
import { motion } from "framer-motion";
import { Repeat, Calendar, Sparkles } from "lucide-react";
import { aiService } from "@/lib/ai/ai-service";
import { formatRecurrenceInterval } from "@/lib/ai/models/recurring-detector";

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
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

export default function RecurringTransactionsCard({ transactions }: { transactions: Transaction[] }) {
  const patterns = useMemo(
    () => aiService.detectRecurringTransactions(transactions),
    [transactions]
  );

  if (patterns.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-4 border border-primary/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Repeat className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-sm font-semibold text-foreground flex items-center gap-1.5">
            Recurring Patterns
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </h3>
          <p className="text-xs text-muted-foreground">Detected subscriptions & bills</p>
        </div>
      </div>

      <div className="space-y-3">
        {patterns.slice(0, 5).map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/20 border border-border/50"
          >
            <div>
              <p className="font-medium text-sm text-foreground truncate max-w-[180px]">
                {p.description}
              </p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{formatRecurrenceInterval(p.interval)}</span>
                <span>·</span>
                <span>{Math.round(p.confidence * 100)}% confidence</span>
              </div>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-bold text-foreground">
                {formatCurrency(p.amount)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Next: {new Date(p.nextExpectedDate).toLocaleDateString("en-UG", { month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
