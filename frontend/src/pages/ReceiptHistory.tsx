import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Receipt,
  Image,
  Search,
  TrendingUp,
  TrendingDown,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  LayoutList,
  SlidersHorizontal,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ───────── Types ───────── */

interface ReceiptRecord {
  id: string;
  merchant: string;
  total_amount: number;
  date: string;
  category: string;
  items: { description: string; amount: number; category?: string }[];
  image_url?: string;
}

interface PriceComparison {
  item: string;
  prices: { merchant: string; date: string; price: number }[];
  trend: "up" | "down" | "stable";
  changePercent: number;
}

/* ───────── Helpers ───────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildPriceComparisons(receipts: ReceiptRecord[]): PriceComparison[] {
  // Group items by normalized description
  const itemPrices: Record<string, { merchant: string; date: string; price: number }[]> = {};

  receipts.forEach((r) => {
    (r.items ?? []).forEach((item) => {
      const key = item.description.toLowerCase().trim();
      if (!itemPrices[key]) itemPrices[key] = [];
      itemPrices[key].push({ merchant: r.merchant, date: r.date, price: item.amount });
    });
  });

  const comparisons: PriceComparison[] = [];

  for (const [item, prices] of Object.entries(itemPrices)) {
    if (prices.length < 2) continue;

    const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date));
    const first = sorted[0].price;
    const last = sorted[sorted.length - 1].price;
    const changePercentRaw = first > 0 ? ((last - first) / first) * 100 : 0;
    const changePercent = Math.min(999, Math.max(-999, Math.round(changePercentRaw)));

    comparisons.push({
      item: prices[0].merchant ? item : item,
      prices: sorted,
      trend: changePercent > 3 ? "up" : changePercent < -3 ? "down" : "stable",
      changePercent,
    });
  }

  return comparisons.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 20);
}

/* ───────── Components ───────── */

function ReceiptCard({
  receipt,
  expanded,
  onToggle,
}: {
  receipt: ReceiptRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl border border-border overflow-hidden hover:glass-card-glow transition-all"
    >
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10 shrink-0">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">{receipt.merchant}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{new Date(receipt.date).toLocaleDateString("en-UG", {
                  month: "short", day: "numeric", year: "numeric",
                })}</span>
                <span className="px-1.5 py-0.5 rounded-full bg-muted/30 capitalize">{receipt.category}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-mono text-sm font-bold text-foreground">{formatCurrency(receipt.total_amount)}</span>
            {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-border/50 pt-3">
              {(receipt.items ?? []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-muted/20">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm text-foreground truncate">{item.description}</span>
                    {item.category != null && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary capitalize shrink-0">{item.category}</span>}
                  </div>
                  <span className="font-mono text-sm text-foreground shrink-0 ml-2">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ───────── Main Page ───────── */

export default function ReceiptHistory() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showPriceTab, setShowPriceTab] = useState(false);

  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!isSupabaseConfigured) {
        setIsLoading(false);
        return;
      }
      const { data: userData, error } = await supabase.auth.getUser();
      if (!isActive) return;
      if (error || !userData.user) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("receipts")
        .select("id,merchant,total_amount,date,category,items,image_url")
        .eq("user_id", userData.user.id)
        .order("date", { ascending: false });
      if (!isActive) return;

      setReceipts((data ?? []) as ReceiptRecord[]);
      setIsLoading(false);
    };
    load();
    return () => {
      isActive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return receipts;
    const q = search.toLowerCase();
    return receipts.filter(
      (r) =>
        r.merchant.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.items ?? []).some((i) => i.description.toLowerCase().includes(q))
    );
  }, [receipts, search]);

  const priceComparisons = useMemo(() => buildPriceComparisons(receipts), [receipts]);

  const totalSpent = receipts.reduce((s, r) => s + r.total_amount, 0);
  const merchantCount = new Set(receipts.map((r) => r.merchant)).size;
  const avgReceipt = receipts.length > 0 ? totalSpent / receipts.length : 0;

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-secondary flex items-center justify-center shadow-glow-secondary">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              Receipt History
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Browse scanned receipts and compare prices over time
            </p>
          </div>
        </motion.header>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Receipts</p>
            <p className="font-mono text-2xl font-bold text-foreground">{receipts.length}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Merchants</p>
            <p className="font-mono text-2xl font-bold text-primary">{merchantCount}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Avg Receipt</p>
            <p className="font-mono text-2xl font-bold text-success">{formatCurrency(avgReceipt)}</p>
          </motion.div>
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPriceTab(false)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                !showPriceTab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Receipt className="w-4 h-4 inline mr-1.5" />
              All Receipts
            </button>
            <button
              onClick={() => setShowPriceTab(true)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                showPriceTab ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <SlidersHorizontal className="w-4 h-4 inline mr-1.5" />
              Price Tracker ({priceComparisons.length})
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search receipts..."
                className="pl-9 pr-4 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 w-56"
              />
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground animate-pulse">Loading receipts...</p>
          </div>
        )}

        {/* Receipts List */}
        {!isLoading && !showPriceTab && (
          <>
            {filtered.length > 0 ? (
              <div className="space-y-3">
                {filtered.map((receipt) => (
                  <ReceiptCard
                    key={receipt.id}
                    receipt={receipt}
                    expanded={expandedId === receipt.id}
                    onToggle={() => setExpandedId(expandedId === receipt.id ? null : receipt.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center space-y-2">
                <Image className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <p className="text-foreground font-medium">No receipts yet</p>
                <p className="text-muted-foreground text-sm">
                  Scan receipts from the Transactions page to build your history.
                </p>
              </div>
            )}
          </>
        )}

        {/* Price Comparison Tab */}
        {!isLoading && showPriceTab && (
          <>
            {priceComparisons.length > 0 ? (
              <div className="space-y-3">
                {priceComparisons.map((comp, idx) => (
                  <motion.div
                    key={comp.item}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="glass-card rounded-xl p-4 border border-border"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-foreground capitalize">{comp.item}</h3>
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-mono font-bold",
                        comp.trend === "up" ? "text-destructive" : comp.trend === "down" ? "text-success" : "text-muted-foreground"
                      )}>
                        {comp.trend === "up" && <TrendingUp className="w-3.5 h-3.5" />}
                        {comp.trend === "down" && <TrendingDown className="w-3.5 h-3.5" />}
                        {comp.changePercent >= 0 ? "+" : ""}{comp.changePercent}%
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {comp.prices.map((p, i) => (
                        <div key={`${p.merchant}-${p.date}-${i}`} className="text-xs px-2 py-1 rounded-full bg-muted/30">
                          <span className="text-muted-foreground">{p.merchant}</span>
                          <span className="font-mono font-bold text-foreground ml-1">{formatCurrency(p.price)}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center space-y-2">
                <SlidersHorizontal className="w-12 h-12 mx-auto text-muted-foreground/50" />
                <p className="text-foreground font-medium">No price data yet</p>
                <p className="text-muted-foreground text-sm">
                  Scan more receipts with the same items to track price changes.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
