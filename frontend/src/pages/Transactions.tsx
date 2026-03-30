import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
  Mic,
  X,
  Coffee,
  ShoppingBag,
  Car,
  Utensils,
  Home,
  Smartphone,
  Plane,
  Heart,
  Briefcase,
  Sparkles,
  AlertTriangle,
  Zap,
  BookOpen,
  Phone,
  Ticket,
  Droplet,
  PiggyBank,
  Gift,
  Shield,
  CreditCard,
  MoreHorizontal,
  Receipt,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { aiService } from "@/lib/ai/ai-service";
import { detectAnomalyWithModel, recordFalsePositive, type AnomalyResult } from "@/lib/ai/models/anomaly-detector";
import type { TrainingTransaction } from "@/lib/ai/training-data";
import { Badge } from "@/components/ui/badge";
import { addNotification, getUserEmail, markEmailSent, wasEmailSent } from "@/lib/notifications";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { ReceiptScanner } from "@/components/dashboard/ReceiptScanner";
import { aiFetch } from "@/lib/api";
import RecurringTransactionsCard from "@/components/dashboard/RecurringTransactionsCard";
import {
  wouldExceedBudget,
  getExpenseBudgetHeadroom,
  getExpenseBudgetRequirementMessage,
  formatCurrency as formatBudgetCurrency,
} from "@/lib/budget-alerts";
import { normalizeMlCategoryForApp } from "@/lib/ml/mlCategory";

const categoryIcons: Record<string, typeof Coffee> = {
  Rent: Home,
  Utilities: Zap,
  Food: ShoppingBag,
  "Eating Out": Utensils,
  Education: BookOpen,
  Communication: Phone,
  Clothing: ShoppingBag,
  Entertainment: Ticket,
  "Personal Care": Droplet,
  Savings: PiggyBank,
  "Gifts / Donations": Gift,
  Insurance: Shield,
  "Debt Payments": CreditCard,
  Miscellaneous: MoreHorizontal,
  Dining: Utensils,
  Shopping: ShoppingBag,
  Transport: Car,
  Coffee: Coffee,
  Housing: Home,
  Tech: Smartphone,
  Travel: Plane,
  Health: Heart,
  Income: Briefcase,
};

const categoryColors: Record<string, string> = {
  Rent: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  Utilities: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  Food: "bg-green-500/10 text-green-400 border-green-500/30",
  "Eating Out": "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Education: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  Communication: "bg-sky-500/10 text-sky-400 border-sky-500/30",
  Clothing: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  Entertainment: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  "Personal Care": "bg-rose-500/10 text-rose-400 border-rose-500/30",
  Savings: "bg-success/10 text-success border-success/30",
  "Gifts / Donations": "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Insurance: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  "Debt Payments": "bg-destructive/10 text-destructive border-destructive/30",
  Miscellaneous: "bg-muted text-muted-foreground border-border",
  Dining: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  Shopping: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  Transport: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  Coffee: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  Housing: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  Tech: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  Travel: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  Health: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  Income: "bg-success/10 text-success border-success/30",
};

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  time: string;
  receiptUrl?: string;
  receiptName?: string;
  receiptType?: string;
}

interface TransactionRow {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  time: string;
  receipt_url: string | null;
  receipt_name: string | null;
  receipt_type: string | null;
}

function mapTransactionRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    description: row.description,
    amount: row.amount,
    type: row.type,
    category: row.category,
    date: row.date,
    time: row.time,
    receiptUrl: row.receipt_url ?? undefined,
    receiptName: row.receipt_name ?? undefined,
    receiptType: row.receipt_type ?? undefined,
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

interface ParsedTransaction {
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
}

const APP_CATEGORIES = Object.keys(categoryIcons);

async function parseNaturalLanguage(input: string): Promise<(ParsedTransaction & { confidence?: number }) | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  const amountMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*(k|K|thousand|thousands)?/i);
  let amount = 0;
  if (amountMatch) {
    amount = parseFloat(amountMatch[1]);
    if (amountMatch[2] && /k|thousand/i.test(amountMatch[2])) {
      amount *= 1000;
    }
  }

  const isIncome = /received|income|salary|payment|deposit|earned|got|refund/i.test(lower);
  const isExpense = /spent|bought|purchase|paid|expense|cost/i.test(lower);
  const type: "income" | "expense" = isIncome ? "income" : (isExpense ? "expense" : "expense");

  // Predict category from text alone (no amount required)
  let category = "Miscellaneous";
  let confidence: number | undefined;
  try {
    const aiResponse = await aiFetch(`/api/v1/categorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
    });

    if (aiResponse.ok) {
      const aiResult = await aiResponse.json();
      const raw = aiResult.category as string;
      category = normalizeMlCategoryForApp(raw, APP_CATEGORIES);
      confidence = aiResult.confidence;
    }
  } catch (error) {
    console.error("Failed to fetch ML categorization:", error);
    const aiResult = aiService.categorizeTransaction(trimmed, amount || 1, undefined, type);
    category = normalizeMlCategoryForApp(aiResult.category, APP_CATEGORIES);
    confidence = aiResult.confidence;
  }

  let description = trimmed;
  if (description.length > 50) {
    description = description.substring(0, 50) + "...";
  }
  return { description, amount, type, category, confidence };
}
const QUICK_ENTRY_DEBOUNCE_MS = 350;

type TxForBudget = { category: string; amount: number; type: string };
type PodForBudget = { id: string; name: string; allocated: number; spent: number };

function QuickEntry({
  onClose,
  onAdd,
  transactions,
  fluxPods,
  fluxPodsLoaded,
}: {
  onClose: () => void;
  onAdd: (tx: Transaction) => void;
  transactions: TxForBudget[];
  fluxPods: PodForBudget[];
  fluxPodsLoaded: boolean;
}) {
  const [input, setInput] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [parsed, setParsed] = useState<(ParsedTransaction & { confidence?: number }) | null>(null);

  // Debounce categorization so the trained model doesn't run on every keystroke
  useEffect(() => {
    if (!input.trim()) {
      setParsed(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      const result = await parseNaturalLanguage(input);
      setParsed(result);
    }, QUICK_ENTRY_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    return () => {};
  }, [receiptUrl]);

  const effectiveAmount = (() => {
    if (manualAmount.trim()) {
      const m = manualAmount.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|K)?/i);
      if (m) {
        let a = parseFloat(m[1]);
        if (m[2] && /k/i.test(m[2])) a *= 1000;
        return a;
      }
    }
    return parsed?.amount ?? 0;
  })();

  const budgetHeadroom = useMemo(() => {
    if (!parsed || parsed.type !== "expense" || effectiveAmount <= 0 || fluxPods.length === 0) return null;
    return getExpenseBudgetHeadroom(fluxPods, transactions, {
      category: parsed.category,
      amount: effectiveAmount,
    });
  }, [parsed, effectiveAmount, fluxPods, transactions]);

  const expenseBudgetRequirementMessage =
    parsed?.type === "expense"
      ? getExpenseBudgetRequirementMessage(fluxPods, parsed.category, fluxPodsLoaded)
      : null;

  const handleAdd = () => {
    if (!parsed) return;
    if (effectiveAmount <= 0) {
      toast({
        title: "Amount required",
        description: "Enter the amount in the text (e.g. '5000') or in the Amount field.",
        variant: "destructive",
      });
      return;
    }
    if (parsed.type === "expense" && expenseBudgetRequirementMessage) {
      toast({
        title: "Budget required",
        description: expenseBudgetRequirementMessage,
        variant: "destructive",
      });
      return;
    }

    const now = new Date();
    const date = now.toISOString().split("T")[0];
    const time = now.toLocaleTimeString("en-UG", { hour: "2-digit", minute: "2-digit", hour12: false });

    const newTransaction: Transaction = {
      id: Date.now().toString(),
      description: parsed.description,
      amount: effectiveAmount,
      type: parsed.type,
      category: parsed.category,
      date,
      time,
      receiptUrl: receiptUrl ?? undefined,
      receiptName: receiptFile?.name,
      receiptType: receiptFile?.type,
    };

    onAdd(newTransaction);
    setInput("");
    setManualAmount("");
    setReceiptFile(null);
    setReceiptUrl(null);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-lg glass-card-glow rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold text-foreground">Quick Entry</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          {/* Natural Language Input */}
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder='e.g. "bought pain killers at pharmacy" or "spent 450 on coffee"'
              className="w-full px-4 py-3 bg-muted/50 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              autoFocus
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={() => {
                toast({
                  title: "Voice input",
                  description: "Voice input feature will be available soon. For now, type your transaction.",
                });
              }}
            >
              <Mic className="w-4 h-4" />
            </Button>
          </div>

          {/* Optional Amount (when not in text) */}
          <div className="space-y-2">
            <Label htmlFor="manual-amount" className="text-xs text-muted-foreground uppercase tracking-wider">
              Amount (optional if in text above)
            </Label>
            <Input
              id="manual-amount"
              type="text"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              placeholder="e.g. 5000 or 10k"
              className="bg-muted/30 border-border"
            />
          </div>

          {/* Receipt Upload */}
          <div className="space-y-2">
            <Label htmlFor="receipt-upload" className="text-xs text-muted-foreground uppercase tracking-wider">
              Receipt (optional)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                id="receipt-upload"
                type="file"
                accept="image/*,application/pdf"
                className="bg-muted/30 border-border"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = () => {
                      setReceiptFile(file);
                      setReceiptUrl(typeof reader.result === "string" ? reader.result : null);
                    };
                    reader.onerror = () => {
                      toast({
                        title: "Receipt upload failed",
                        description: "Please try a different file.",
                        variant: "destructive",
                      });
                      setReceiptFile(null);
                      setReceiptUrl(null);
                    };
                    reader.readAsDataURL(file);
                  } else {
                    setReceiptFile(null);
                    setReceiptUrl(null);
                  }
                }}
              />
              {receiptUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setReceiptFile(null);
                    setReceiptUrl(null);
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
            {receiptFile && (
              <p className="text-xs text-muted-foreground">
                Attached: {receiptFile.name}
              </p>
            )}
          </div>

          {/* Parsed Preview */}
          {parsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="p-4 rounded-xl border border-primary/30 bg-primary/5"
            >
              <p className="text-xs text-primary uppercase tracking-wider mb-2 flex items-center gap-2">
                <Sparkles className="w-3 h-3" />
                Preview from scan
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = categoryIcons[parsed.category] || Briefcase;
                    return <Icon className="w-5 h-5 text-primary" />;
                  })()}
                  <span className="text-foreground">{parsed.description}</span>
                  {receiptFile && (
                    <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                      Receipt attached
                    </Badge>
                  )}
                </div>
                <span className={cn("font-mono", parsed.type === "income" ? "text-success" : "text-destructive")}>
                  {parsed.type === "income" ? "+" : "-"}
                  {formatCurrency(effectiveAmount)}
                  {effectiveAmount === 0 && (
                    <span className="text-muted-foreground text-xs ml-1">(add amount)</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-muted-foreground">Today • Category: {parsed.category}</p>
                {parsed.confidence != null && (
                  <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                    {Math.round(parsed.confidence * 100)}% confidence
                  </Badge>
                )}
              </div>
              {parsed.type === "expense" && budgetHeadroom && effectiveAmount > 0 && (
                <div
                  className={cn(
                    "mt-3 rounded-lg border px-3 py-2 text-xs",
                    budgetHeadroom.overBy > 0
                      ? "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-success/30 bg-success/10 text-foreground"
                  )}
                >
                  {budgetHeadroom.overBy > 0 ? (
                    <p>
                      This would put your <strong>{budgetHeadroom.podName}</strong> budget{" "}
                      <strong>{formatBudgetCurrency(budgetHeadroom.overBy)}</strong> over your limit (
                      {formatBudgetCurrency(budgetHeadroom.allocated)} planned).
                    </p>
                  ) : (
                    <p>
                      Your <strong>{budgetHeadroom.podName}</strong> budget:{" "}
                      <strong>{formatBudgetCurrency(budgetHeadroom.remainingBefore)}</strong> left before this
                      entry, <strong>{formatBudgetCurrency(budgetHeadroom.remainingAfter)}</strong> after (
                      limit {formatBudgetCurrency(budgetHeadroom.allocated)}).
                    </p>
                  )}
                </div>
              )}
              {parsed.type === "expense" && fluxPodsLoaded && expenseBudgetRequirementMessage && (
                <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {expenseBudgetRequirementMessage} This expense can’t be added until a matching budget exists.
                </p>
              )}
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-border hover:border-primary/50 hover:bg-primary/5"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-primary hover:opacity-90"
              disabled={!parsed || !!expenseBudgetRequirementMessage}
              onClick={handleAdd}
            >
              Add Transaction
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Transactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [showReceiptScanner, setShowReceiptScanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    description: string;
    amount: string;
    type: "income" | "expense";
    category: string;
  }>({ description: "", amount: "", type: "expense", category: "Other" });
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [anomalies, setAnomalies] = useState<Record<string, AnomalyResult & { isAnomaly: boolean; severity: string; reason: string }>>({});
  const [recategorizing, setRecategorizing] = useState(false);
  const [fluxPods, setFluxPods] = useState<{ id: string; name: string; allocated: number; spent: number }[]>([]);
  const [fluxPodsLoaded, setFluxPodsLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;
    const loadTransactions = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive) return;
      if (userError || !userData.user) {
        setIsLoading(false);
        return;
      }
      setUserId(userData.user.id);
      const { data, error } = await supabase
        .from("transactions")
        .select("id,description,amount,type,category,date,time,receipt_url,receipt_name,receipt_type,created_at")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });
      if (!isActive) return;
      if (error) {
        toast({
          title: "Failed to load transactions",
          description: error.message,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      const mapped = (data ?? []).map((row) => mapTransactionRow(row as TransactionRow));
      setTransactions(mapped);
      setIsLoading(false);
    };
    loadTransactions();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setFluxPods([]);
      setFluxPodsLoaded(false);
      return;
    }
    if (!userId) {
      setFluxPods([]);
      setFluxPodsLoaded(false);
      return;
    }
    let cancelled = false;
    setFluxPodsLoaded(false);
    const loadPods = async () => {
      const { data } = await supabase
        .from("flux_pods")
        .select("id,name,allocated,spent")
        .eq("user_id", userId);
      if (cancelled) return;
      setFluxPods((data ?? []) as { id: string; name: string; allocated: number; spent: number }[]);
      setFluxPodsLoaded(true);
    };
    loadPods();
    return () => {
      cancelled = true;
    };
  }, [userId, isSupabaseConfigured]);

  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    const channel = supabase
      .channel("transactions-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const created = mapTransactionRow(payload.new as TransactionRow);
            setTransactions((prev) => (prev.some((tx) => tx.id === created.id) ? prev : [created, ...prev]));
          }
          if (payload.eventType === "UPDATE") {
            const updated = mapTransactionRow(payload.new as TransactionRow);
            setTransactions((prev) => prev.map((tx) => (tx.id === updated.id ? updated : tx)));
          }
          if (payload.eventType === "DELETE") {
            const removedId = (payload.old as { id: string }).id;
            setTransactions((prev) => prev.filter((tx) => tx.id !== removedId));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // Initialize AI service with transaction data
  useEffect(() => {
    const trainingData: TrainingTransaction[] = transactions.map((tx) => ({
      description: tx.description,
      amount: tx.amount,
      category: tx.category,
      type: tx.type,
      date: tx.date,
    }));

    const incomeTotal = trainingData
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);
    aiService.initialize(trainingData, incomeTotal);

    let cancelled = false;
    (async () => {
      const anomalyMap: Record<string, AnomalyResult & { isAnomaly: boolean; severity: string; reason: string }> = {};
      const today = new Date().toISOString().split("T")[0];
      const results = await Promise.all(
        transactions.map((tx) => {
          const trainingTx: TrainingTransaction = {
            description: tx.description,
            amount: tx.amount,
            category: tx.category,
            type: tx.type,
            date: tx.date,
          };
          return detectAnomalyWithModel(trainingTx, trainingData).then((result) => ({ tx, result }));
        })
      );
      if (cancelled) return;
      for (const { tx, result } of results) {
        if (result.isAnomaly) {
          anomalyMap[tx.id] = {
            ...result,
            isAnomaly: true,
            severity: result.severity,
            reason: result.reason,
          };

          const notificationId = `anomaly-${tx.id}`;
          addNotification(
            {
              id: notificationId,
              type: "anomaly",
              title: "Unusual spending",
              message: result.reason,
              createdAt: new Date().toISOString(),
            },
            userId
          );

          // Only send email for anomalies on today's transactions,
          // to avoid spamming the user for all historical anomalies.
          const emailAlertsOn = !["0", "false", "no", "off"].includes(
            String(import.meta.env.VITE_ENABLE_EMAIL_ALERTS ?? "true").trim().toLowerCase()
          );
          if (
            emailAlertsOn &&
            tx.date === today &&
            !wasEmailSent(notificationId, userId)
          ) {
            const to = getUserEmail();
            if (to) {
              fetch(import.meta.env.VITE_NOTIFICATION_API_URL ?? "http://localhost:5174/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  to,
                  subject: "UniGuard Wallet: unusual spending flagged",
                  text: result.reason,
                }),
              })
                .then(() => {
                  markEmailSent(notificationId, userId);
                })
                .catch((error) => {
                  console.error("Failed to send notification email", error);
                });
            }
          }
        }
      }
      setAnomalies(anomalyMap);
    })();
    return () => {
      cancelled = true;
    };
  }, [transactions]);

  useEffect(() => {
    if (!editingId) return;
    const tx = transactions.find((item) => item.id === editingId);
    if (!tx) return;
    setEditDraft({
      description: tx.description,
      amount: tx.amount.toString(),
      type: tx.type,
      category: tx.category,
    });
  }, [editingId, transactions]);

  const handleAddTransaction = async (tx: Transaction) => {
    if (!userId) {
      toast({
        title: "Sign in required",
        description: "Please sign in to add transactions.",
        variant: "destructive",
      });
      return;
    }
    if (tx.type === "expense") {
      const budgetMsg = getExpenseBudgetRequirementMessage(fluxPods, tx.category, fluxPodsLoaded);
      if (budgetMsg) {
        toast({
          title: "Budget required",
          description: budgetMsg,
          variant: "destructive",
        });
        return;
      }
    }
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        date: tx.date,
        time: tx.time,
        receipt_url: tx.receiptUrl ?? null,
        receipt_name: tx.receiptName ?? null,
        receipt_type: tx.receiptType ?? null,
      })
      .select("id,description,amount,type,category,date,time,receipt_url,receipt_name,receipt_type,created_at")
      .single();
    if (error || !data) {
      toast({
        title: "Failed to add transaction",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
      return;
    }
    const saved = mapTransactionRow(data as TransactionRow);
    setTransactions((prev) => [saved, ...prev]);

    if (saved.type === "expense" && fluxPods.length > 0) {
      const over = wouldExceedBudget(
        fluxPods,
        transactions,
        { category: saved.category, amount: saved.amount }
      );
      if (over) {
        addNotification(
          {
            id: `budget-over-${over.pod.id}`,
            type: "budget_over",
            title: `"${over.pod.name}" over budget`,
            message: `This expense pushed spending over the allocated ${formatBudgetCurrency(over.pod.allocated)} by ${formatBudgetCurrency(over.overBy)}.`,
            createdAt: new Date().toISOString(),
          },
          userId
        );
        toast({
          title: "Budget exceeded",
          description: `"${over.pod.name}" is now over budget by ${formatBudgetCurrency(over.overBy)}.`,
          variant: "destructive",
        });
      } else {
        const head = getExpenseBudgetHeadroom(fluxPods, transactions, {
          category: saved.category,
          amount: saved.amount,
        });
        toast({
          title: "Transaction added",
          description: head
            ? `${saved.type === "income" ? "Income" : "Expense"} ${formatCurrency(saved.amount)} saved. About ${formatBudgetCurrency(head.remainingAfter)} left in your ${head.podName} budget.`
            : `${saved.type === "income" ? "Income" : "Expense"} of ${formatCurrency(saved.amount)} has been added.`,
        });
      }
    } else {
      toast({
        title: "Transaction added",
        description: `${saved.type === "income" ? "Income" : "Expense"} of ${formatCurrency(saved.amount)} has been added.`,
      });
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const amountValue = parseFloat(editDraft.amount);
    if (!editDraft.description.trim() || Number.isNaN(amountValue) || amountValue < 0) {
      toast({
        title: "Invalid transaction",
        description: "Please provide a description and a valid amount.",
        variant: "destructive",
      });
      return;
    }
    if (editDraft.type === "expense") {
      const budgetMsg = getExpenseBudgetRequirementMessage(fluxPods, editDraft.category, fluxPodsLoaded);
      if (budgetMsg) {
        toast({
          title: "Budget required",
          description: budgetMsg,
          variant: "destructive",
        });
        return;
      }
    }
    const { error } = await supabase
      .from("transactions")
      .update({
        description: editDraft.description.trim(),
        amount: amountValue,
        type: editDraft.type,
        category: editDraft.category,
      })
      .eq("id", editingId)
      .eq("user_id", userId ?? "");
    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setTransactions((prev) =>
      prev.map((tx) =>
        tx.id === editingId
          ? {
              ...tx,
              description: editDraft.description.trim(),
              amount: amountValue,
              type: editDraft.type,
              category: editDraft.category,
            }
          : tx
      )
    );
    setEditingId(null);
    toast({
      title: "Transaction updated",
      description: "Your changes have been saved.",
    });
  };

  const handleRecategorize = async () => {
    const amountValue = parseFloat(editDraft.amount);
    if (Number.isNaN(amountValue) || !editDraft.description.trim()) return;
    setRecategorizing(true);
    
    try {
      const aiResponse = await aiFetch(`/api/v1/categorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editDraft.description })
      });
      
      let category = "Miscellaneous";
      if (aiResponse.ok) {
        const aiResult = await aiResponse.json();
        category = normalizeMlCategoryForApp(aiResult.category as string, APP_CATEGORIES);
      } else {
        const aiResult = aiService.categorizeTransaction(
          editDraft.description,
          amountValue,
          undefined,
          editDraft.type
        );
        category = normalizeMlCategoryForApp(aiResult.category, APP_CATEGORIES);
      }
      setEditDraft((prev) => ({ ...prev, category }));
    } catch (error) {
      console.error("Categorization failed", error);
    } finally {
      setRecategorizing(false);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    const { error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", userId ?? "");
    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    setSelectedIds((prev) => prev.filter((selectedId) => selectedId !== id));
    toast({
      title: "Transaction deleted",
      description: tx ? `"${tx.description}" has been removed.` : "Transaction has been removed.",
    });
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.length;
    if (!count) return;
    const { error } = await supabase
      .from("transactions")
      .delete()
      .in("id", selectedIds)
      .eq("user_id", userId ?? "");
    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setTransactions((prev) => prev.filter((tx) => !selectedIds.includes(tx.id)));
    setSelectedIds([]);
    toast({
      title: "Transactions deleted",
      description: `${count} transaction${count > 1 ? "s" : ""} removed.`,
    });
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || tx.category === filterCategory;
    const matchesType = filterType === "all" || tx.type === filterType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const groupedByDate = filteredTransactions.reduce((acc, tx) => {
    const date = tx.date;
    if (!acc[date]) acc[date] = [];
    acc[date].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-UG", { weekday: "long", month: "short", day: "numeric" });
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 pb-28 space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Transaction Center</h1>
            <p className="text-muted-foreground text-sm mt-1">Track every flow of money</p>
          </div>
        </motion.header>

        {/* Reconciliation helper – review anomalies before reconciling */}
        {!isLoading && Object.keys(anomalies).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 border border-warning/30 bg-warning/5"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  You have {Object.keys(anomalies).length} anomal{Object.keys(anomalies).length !== 1 ? "ies" : "y"} to review
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review these flagged transactions before reconciling with your bank statement.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {isLoading && (
          <div className="glass-card rounded-xl p-4 text-sm text-muted-foreground">
            Loading your transactions...
          </div>
        )}

        {/* Search and Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-3"
        >
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search transactions..."
              className="w-full pl-11 pr-4 py-2.5 bg-muted/30 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm h-10"
            />
          </div>
          <Button
            variant="outline"
            className="border-border hover:border-primary/50 h-10"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </motion.div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="glass-card rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Category</label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="all">All Categories</option>
                    {Object.keys(categoryIcons).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="all">All Types</option>
                    <option value="income">Income</option>
                    <option value="expense">Expense</option>
                  </select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recurring Patterns (Pattern Mining) */}
        <RecurringTransactionsCard transactions={transactions} />

        {/* Bulk Actions */}
        <AnimatePresence>
          {selectedIds.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-3 p-3 glass-card rounded-xl"
            >
              <span className="text-sm text-muted-foreground">
                {selectedIds.length} selected
              </span>
              <div className="flex-1" />
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-destructive hover:text-destructive-glow"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transaction List */}
        <div className="space-y-6">
          {filteredTransactions.length === 0 && (
            <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">
              No transactions yet. Add your first entry to start tracking real data.
            </div>
          )}
          {Object.entries(groupedByDate).map(([date, transactions], groupIndex) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + groupIndex * 0.05 }}
            >
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2 py-1.5 bg-muted/40 rounded-lg inline-block">
                {formatDate(date)}
              </h3>
              <div className="glass-card rounded-xl overflow-hidden divide-y divide-border">
                {transactions.map((tx, index) => {
                  const Icon = categoryIcons[tx.category] || Briefcase;
                  const colorClass = categoryColors[tx.category] || "bg-muted text-muted-foreground border-border";
                  const isSelected = selectedIds.includes(tx.id);

                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + index * 0.03 }}
                      className={cn(
                        "flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer group",
                        isSelected && "bg-primary/5"
                      )}
                      onClick={() => {
                        setSelectedIds((prev) =>
                          prev.includes(tx.id)
                            ? prev.filter((id) => id !== tx.id)
                            : [...prev, tx.id]
                        );
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          isSelected
                            ? "bg-primary border-primary"
                            : "border-border group-hover:border-primary/50"
                        )}
                      >
                        {isSelected && (
                          <motion.svg
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-3 h-3 text-primary-foreground"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </motion.svg>
                        )}
                      </div>

                      {/* Category Icon */}
                      <div className={cn("p-2.5 rounded-xl border", colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {tx.description}
                          </p>
                          {tx.receiptUrl && (
                            <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary/30 text-primary">
                              Receipt
                            </Badge>
                          )}
                          {anomalies[tx.id]?.isAnomaly && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs px-1.5 py-0 gap-1 group/badge cursor-default",
                                anomalies[tx.id].severity === "high" && "border-destructive text-destructive",
                                anomalies[tx.id].severity === "medium" && "border-warning text-warning",
                                anomalies[tx.id].severity === "low" && "border-muted-foreground text-muted-foreground"
                              )}
                              title={anomalies[tx.id].reason}
                            >
                              <AlertTriangle className="w-3 h-3" />
                              Worth a look
                              <button
                                type="button"
                                className="opacity-0 group-hover/badge:opacity-100 ml-0.5 rounded hover:bg-muted/50 p-0.5 -mr-0.5 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const a = anomalies[tx.id];
                                  if (a) {
                                    recordFalsePositive(a, tx.category, Math.abs(tx.amount));
                                    setAnomalies((prev) => {
                                      const next = { ...prev };
                                      delete next[tx.id];
                                      return next;
                                    });
                                    toast({ title: "Marked as normal", description: "Similar spending won’t be highlighted next time." });
                                  }
                                }}
                                aria-label="This is normal spending for me"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs px-1.5 py-0 border-primary/30 text-primary">
                            <Sparkles className="w-3 h-3 mr-1" />
                            Auto
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {tx.time} • {tx.category}
                        </p>
                        {tx.receiptUrl && (
                          <a
                            href={tx.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            View receipt
                          </a>
                        )}
                      </div>

                      {/* Amount */}
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-mono font-semibold",
                            tx.type === "income" ? "text-success" : "text-foreground"
                          )}
                        >
                          {tx.type === "income" ? "+" : "-"}
                          {formatCurrency(tx.amount)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(tx.id);
                          }}
                        >
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete transaction "${tx.description}"?`)) {
                              handleDeleteTransaction(tx.id);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Floating Action Buttons */}
        <div className="fixed bottom-6 right-24 flex items-center gap-3 z-40">
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowReceiptScanner(true)}
            className="w-14 h-14 rounded-full bg-secondary/80 shadow-glow-md flex items-center justify-center hover:shadow-glow-lg transition-shadow"
            title="Scan Receipt"
          >
            <Receipt className="w-6 h-6 text-secondary-foreground" />
          </motion.button>
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowQuickEntry(true)}
            className="w-14 h-14 rounded-full bg-gradient-primary shadow-glow-md flex items-center justify-center hover:shadow-glow-lg transition-shadow"
            title="Quick Entry"
          >
            <Plus className="w-6 h-6 text-primary-foreground" />
          </motion.button>
        </div>

        {/* Quick Entry Modal */}
        <AnimatePresence>
          {showQuickEntry && (
            <QuickEntry
              onClose={() => setShowQuickEntry(false)}
              onAdd={handleAddTransaction}
              transactions={transactions}
              fluxPods={fluxPods}
              fluxPodsLoaded={fluxPodsLoaded}
            />
          )}
        </AnimatePresence>

        {/* Receipt Scanner Modal */}
        <AnimatePresence>
          {showReceiptScanner && (
            <ReceiptScanner
              onClose={() => setShowReceiptScanner(false)}
              onConfirmSplit={async (parsed) => {
                setShowReceiptScanner(false);

                if (!isSupabaseConfigured || !userId) return;

                const now = new Date();
                const date = now.toISOString().split("T")[0];
                const time = now.toLocaleTimeString("en-UG", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });

                const textToCategorize = parsed.rawText.trim() || parsed.extractedText.join(" ");
                let category = "Miscellaneous";
                try {
                  const catRes = await aiFetch(`/api/v1/categorize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: textToCategorize }),
                  });
                  if (catRes.ok) {
                    const data = await catRes.json();
                    category = normalizeMlCategoryForApp(data.category as string | undefined, APP_CATEGORIES);
                  }
                } catch {
                  category = "Miscellaneous";
                }

                const merchant = parsed.structured?.merchant ?? parsed.extractedText[0];
                const amount = typeof parsed.structured?.amount === "number" && parsed.structured.amount > 0
                  ? parsed.structured.amount
                  : parsed.suggestedAmount;
                const receiptDate = parsed.structured?.date;
                const description =
                  merchant
                    ? String(merchant).slice(0, 80) + (parsed.extractedText.length > 1 ? ` (${parsed.extractedText.length} lines)` : "")
                    : "Receipt";

                const txDate = receiptDate ? String(receiptDate).replace(/\//g, "-") : date;
                const singleTransaction = {
                  user_id: userId,
                  description,
                  amount,
                  type: "expense" as const,
                  category,
                  date: txDate,
                  time,
                };

                const receiptBudgetMsg = getExpenseBudgetRequirementMessage(fluxPods, category, fluxPodsLoaded);
                if (receiptBudgetMsg) {
                  toast({
                    title: "Budget required",
                    description: receiptBudgetMsg,
                    variant: "destructive",
                  });
                  return;
                }

                const { error: txError } = await supabase.from("transactions").insert(singleTransaction);
                if (txError) {
                  toast({
                    title: "Failed to log receipt",
                    description: txError.message,
                    variant: "destructive",
                  });
                  return;
                }

                const { error: receiptError } = await supabase.from("receipts").insert({
                  user_id: userId,
                  merchant: (merchant ? String(merchant).slice(0, 100) : parsed.extractedText[0]?.slice(0, 100)) ?? "Receipt",
                  total_amount: amount,
                  date: txDate,
                  category,
                  items: [{ description: parsed.rawText, amount }],
                });

                if (receiptError) {
                  console.warn("Receipt saved to transactions but not to receipt history:", receiptError.message);
                }

                toast({
                  title: "Receipt logged",
                  description: `Transaction added (${amount} UGX). Receipt saved to history.`,
                });
              }}
            />
          )}
        </AnimatePresence>

        {/* Edit Transaction Modal */}
        <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
          <DialogContent className="glass-card border-border">
            <DialogHeader>
              <DialogTitle>Edit Transaction</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editDraft.description}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, description: e.target.value }))}
                  className="bg-muted/30 border-border mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="edit-amount">Amount (UGX)</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    value={editDraft.amount}
                    onChange={(e) => setEditDraft((prev) => ({ ...prev, amount: e.target.value }))}
                    className="bg-muted/30 border-border mt-1"
                    min="0"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-type">Type</Label>
                  <select
                    id="edit-type"
                    value={editDraft.type}
                    onChange={(e) => setEditDraft((prev) => ({ ...prev, type: e.target.value as "income" | "expense" }))}
                    className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1"
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="edit-category">Category</Label>
                <select
                  id="edit-category"
                  value={editDraft.category}
                  onChange={(e) => setEditDraft((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 mt-1"
                >
                  {Object.keys(categoryIcons).map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={handleRecategorize}
                  disabled={recategorizing}
                >
                  <Sparkles className={cn("w-4 h-4 mr-1", recategorizing && "animate-pulse")} />
                  {recategorizing ? "Working…" : "Suggest category"}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button className="bg-gradient-primary hover:opacity-90" onClick={handleSaveEdit}>
                    Save Changes
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
