import { useMemo, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  fetchSmartMoneyAdvice,
  plainTextFromAiAdvice,
  runSmartMoneyPipelineAsync,
  type SmartMoneyPipelineResult,
  type SmartMoneyTransactionInput,
} from "@/lib/smart-money";

interface Props {
  transactions: SmartMoneyTransactionInput[];
}

function formatUgx(n: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(Math.max(0, n));
}

export default function SmartMoneyAgentPanel({ transactions }: Props) {
  const [budgetInput, setBudgetInput] = useState("");
  const [llmAdvice, setLlmAdvice] = useState<string | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);

  const monthlyBudgetUgx = useMemo(() => {
    const n = parseFloat(budgetInput.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  }, [budgetInput]);

  const [pipeline, setPipeline] = useState<SmartMoneyPipelineResult | null>(null);

  useEffect(() => {
    if (transactions.length === 0) {
      setPipeline(null);
      return;
    }
    let cancelled = false;
    void runSmartMoneyPipelineAsync(transactions, { monthlyBudgetUgx }).then((p) => {
      if (!cancelled) setPipeline(p);
    });
    return () => {
      cancelled = true;
    };
  }, [transactions, monthlyBudgetUgx]);

  const runAi = useCallback(async () => {
    if (!pipeline) return;
    setLlmLoading(true);
    setLlmAdvice(null);
    try {
      const text = await fetchSmartMoneyAdvice(
        pipeline.insights,
        pipeline.baselineReport,
        monthlyBudgetUgx,
        pipeline.insightModelSignals.summaryForPrompt
      );
      setLlmAdvice(text);
    } finally {
      setLlmLoading(false);
    }
  }, [pipeline, monthlyBudgetUgx]);

  if (transactions.length === 0) return null;

  if (!pipeline) return null;

  const { insights, baselineReport, evaluation, metrics } = pipeline;

  return (
    <Card className="glass-card border-border overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <div className="p-2 rounded-lg bg-primary/15">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          Smart Money analysis
          <span className="ml-auto text-[10px] font-mono text-muted-foreground font-normal">
            Your transactions
          </span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Uses your synced expense data (same records as Reports). Optional monthly budget compares each
          calendar month to your target.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="smart-money-budget" className="text-xs text-muted-foreground">
              Monthly budget (UGX, optional)
            </Label>
            <Input
              id="smart-money-budget"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 2000000"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              className="font-mono"
            />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2 shrink-0"
            onClick={runAi}
            disabled={llmLoading}
          >
            {llmLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {llmLoading ? "Generating…" : "AI advice"}
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg bg-muted/40 p-2 border border-border/50">
            <p className="text-muted-foreground uppercase tracking-wide">Total expenses</p>
            <p className="font-mono font-semibold text-foreground">{formatUgx(insights.totalSpend)}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2 border border-border/50">
            <p className="text-muted-foreground uppercase tracking-wide">Expense rows</p>
            <p className="font-mono font-semibold">{metrics.nExpenseTransactions}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2 border border-border/50">
            <p className="text-muted-foreground uppercase tracking-wide">Categories</p>
            <p className="font-mono font-semibold">{metrics.nCategories}</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2 border border-border/50">
            <p className="text-muted-foreground uppercase tracking-wide">Quality check</p>
            <p
              className={cn(
                "font-mono font-semibold",
                evaluation.passesOtherRatioCheck ? "text-success" : "text-warning"
              )}
            >
              {evaluation.passesOtherRatioCheck ? "OK" : "Review categories"}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card/50 p-3 space-y-2">
          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
            Baseline report
          </p>
          <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
            {baselineReport}
          </pre>
        </div>

        <div className="text-[10px] text-muted-foreground font-mono">
          Uncategorized ratio: {(evaluation.otherRatio * 100).toFixed(1)}% (
          {evaluation.nUncategorized} / {evaluation.nTransactions} expense rows in Miscellaneous/Other)
          · {metrics.runtimeMs} ms
        </div>

        {llmAdvice && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2"
          >
            <p className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-2">
              <Sparkles className="w-3 h-3" />
              AI guidance
            </p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {plainTextFromAiAdvice(llmAdvice)}
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
