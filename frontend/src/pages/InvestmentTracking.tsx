import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  BarChart3,
  DollarSign,
  PieChart,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ───────── Types ───────── */

interface Holding {
  id: string;
  name: string;
  ticker: string;
  type: "stock" | "bond" | "crypto" | "mutual_fund" | "real_estate" | "other";
  purchasePrice: number;
  currentPrice: number;
  quantity: number;
  purchaseDate: string;
}

/* ───────── Helpers ───────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const STORAGE_KEY = "uniguard.investments";
const TYPE_COLORS: Record<string, string> = {
  stock: "#00d4ff",
  bond: "#22c55e",
  crypto: "#f59e0b",
  mutual_fund: "#a855f7",
  real_estate: "#ec4899",
  other: "#6b7280",
};
const TYPE_LABELS: Record<string, string> = {
  stock: "Stock",
  bond: "Bond",
  crypto: "Crypto",
  mutual_fund: "Mutual Fund",
  real_estate: "Real Estate",
  other: "Other",
};

function loadHoldings(): Holding[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

function saveHoldings(h: Holding[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
}

/* ───────── Page ───────── */

export default function InvestmentTracking() {
  const [holdings, setHoldings] = useState<Holding[]>(loadHoldings);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", ticker: "", type: "stock" as Holding["type"],
    purchasePrice: "", currentPrice: "", quantity: "", purchaseDate: "",
  });

  const persist = (h: Holding[]) => { setHoldings(h); saveHoldings(h); };

  const resetForm = () => setForm({ name: "", ticker: "", type: "stock", purchasePrice: "", currentPrice: "", quantity: "", purchaseDate: "" });

  const addOrUpdate = () => {
    if (!form.name || !form.purchasePrice || !form.currentPrice || !form.quantity) return;
    const entry: Holding = {
      id: editId ?? genId(),
      name: form.name,
      ticker: form.ticker.toUpperCase(),
      type: form.type,
      purchasePrice: Number(form.purchasePrice),
      currentPrice: Number(form.currentPrice),
      quantity: Number(form.quantity),
      purchaseDate: form.purchaseDate || new Date().toISOString().slice(0, 10),
    };
    if (editId) {
      persist(holdings.map((h) => h.id === editId ? entry : h));
    } else {
      persist([...holdings, entry]);
    }
    resetForm();
    setShowAdd(false);
    setEditId(null);
  };

  const startEdit = (h: Holding) => {
    setForm({
      name: h.name, ticker: h.ticker, type: h.type,
      purchasePrice: String(h.purchasePrice), currentPrice: String(h.currentPrice),
      quantity: String(h.quantity), purchaseDate: h.purchaseDate,
    });
    setEditId(h.id);
    setShowAdd(true);
  };

  const remove = (id: string) => persist(holdings.filter((h) => h.id !== id));

  // Portfolio stats
  const totalInvested = holdings.reduce((s, h) => s + h.purchasePrice * h.quantity, 0);
  const totalCurrent = holdings.reduce((s, h) => s + h.currentPrice * h.quantity, 0);
  const totalGain = totalCurrent - totalInvested;
  const totalReturn = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  // Allocation by type
  const allocation = useMemo(() => {
    const map: Record<string, number> = {};
    holdings.forEach((h) => {
      const val = h.currentPrice * h.quantity;
      map[h.type] = (map[h.type] ?? 0) + val;
    });
    return Object.entries(map).map(([type, value]) => ({
      type,
      value,
      label: TYPE_LABELS[type] ?? type,
      color: TYPE_COLORS[type] ?? "#6b7280",
      pct: totalCurrent > 0 ? (value / totalCurrent) * 100 : 0,
    }));
  }, [holdings, totalCurrent]);

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              Investments
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Track your investment portfolio and returns</p>
          </div>
          <Button className="bg-gradient-primary" onClick={() => { resetForm(); setEditId(null); setShowAdd(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Holding
          </Button>
        </motion.header>

        {/* Portfolio Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Invested</p>
            <p className="font-mono text-2xl font-bold text-foreground">{formatCurrency(totalInvested)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Value</p>
            <p className="font-mono text-2xl font-bold text-primary">{formatCurrency(totalCurrent)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Gain/Loss</p>
            <p className={cn("font-mono text-2xl font-bold", totalGain >= 0 ? "text-success" : "text-destructive")}>
              {totalGain >= 0 ? "+" : ""}{formatCurrency(totalGain)}
            </p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Return</p>
            <div className="flex items-center gap-1">
              {totalReturn >= 0 ? <TrendingUp className="w-5 h-5 text-success" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
              <p className={cn("font-mono text-2xl font-bold", totalReturn >= 0 ? "text-success" : "text-destructive")}>
                {totalReturn >= 0 ? "+" : ""}{totalReturn.toFixed(1)}%
              </p>
            </div>
          </motion.div>
        </div>

        {/* Allocation Breakdown */}
        {allocation.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Portfolio Allocation</h3>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex mb-3">
              {allocation.map((a) => (
                <div key={a.type} style={{ width: `${a.pct}%`, backgroundColor: a.color }} className="h-full first:rounded-l-full last:rounded-r-full" title={`${a.label}: ${a.pct.toFixed(1)}%`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-3">
              {allocation.map((a) => (
                <div key={a.type} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className="font-mono font-bold text-foreground">{a.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => { setShowAdd(false); setEditId(null); }}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-foreground mb-4">{editId ? "Edit" : "Add"} Holding</h3>
                <div className="space-y-3">
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Asset name (e.g. MTN Uganda)" className="w-full px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="Ticker (optional)" className="px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                    <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Holding["type"] })} className="px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm">
                      {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} type="number" placeholder="Buy price (UGX)" className="px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                    <input value={form.currentPrice} onChange={(e) => setForm({ ...form, currentPrice: e.target.value })} type="number" placeholder="Current price (UGX)" className="px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} type="number" placeholder="Quantity" className="px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                    <input value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} type="date" className="px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setEditId(null); }}>Cancel</Button>
                    <Button className="flex-1 bg-gradient-primary" onClick={addOrUpdate}>{editId ? "Update" : "Add"}</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Holdings List */}
        {holdings.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-foreground font-medium">No investments yet</p>
            <p className="text-muted-foreground text-sm">Add your holdings to track portfolio performance.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {holdings.map((h, idx) => {
              const invested = h.purchasePrice * h.quantity;
              const current = h.currentPrice * h.quantity;
              const gain = current - invested;
              const returnPct = invested > 0 ? (gain / invested) * 100 : 0;

              return (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                  className="glass-card rounded-xl p-4 border border-border hover:border-primary/20 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: TYPE_COLORS[h.type] + "20" }}>
                        <DollarSign className="w-5 h-5" style={{ color: TYPE_COLORS[h.type] }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{h.name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {h.ticker && <span className="font-mono">{h.ticker}</span>}
                          <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: TYPE_COLORS[h.type] + "15", color: TYPE_COLORS[h.type] }}>{TYPE_LABELS[h.type]}</span>
                          <span>{h.quantity} units</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm font-bold text-foreground">{formatCurrency(current)}</p>
                      <div className={cn("flex items-center gap-0.5 text-xs font-mono justify-end", gain >= 0 ? "text-success" : "text-destructive")}>
                        {gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {gain >= 0 ? "+" : ""}{returnPct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => startEdit(h)}>Edit</Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive" onClick={() => remove(h.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
