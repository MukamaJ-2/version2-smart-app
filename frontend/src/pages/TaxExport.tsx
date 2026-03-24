import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Download,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Loader2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ───────── Helpers ───────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadJSON(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Transaction {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  description: string;
  merchant: string;
  date: string;
}

/* ───────── Page ───────── */

export default function TaxExport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [exportFormat, setExportFormat] = useState<"csv" | "json">("csv");

  // Load data
  useEffect(() => {
    let isActive = true;
    const load = async () => {
      if (!isSupabaseConfigured) { setIsLoading(false); return; }
      const { data: userData } = await supabase.auth.getUser();
      if (!isActive || !userData.user) { setIsLoading(false); return; }
      const { data } = await supabase
        .from("transactions")
        .select("id,amount,type,category,description,merchant,date")
        .eq("user_id", userData.user.id)
        .order("date", { ascending: true });
      if (!isActive) return;
      setTransactions((data ?? []) as Transaction[]);
      setIsLoading(false);
    };
    load();
    return () => { isActive = false; };
  }, []);

  // Filter by year
  const yearTx = useMemo(() =>
    transactions.filter((tx) => new Date(tx.date).getFullYear() === year),
    [transactions, year]
  );

  // Tax summary
  const totalIncome = yearTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = yearTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netIncome = totalIncome - totalExpenses;
  const txCount = yearTx.length;

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { income: number; expense: number; count: number }> = {};
    yearTx.forEach((tx) => {
      if (!map[tx.category]) map[tx.category] = { income: 0, expense: 0, count: 0 };
      map[tx.category].count += 1;
      if (tx.type === "income") map[tx.category].income += tx.amount;
      else map[tx.category].expense += tx.amount;
    });
    return Object.entries(map)
      .map(([cat, data]) => ({ category: cat, ...data }))
      .sort((a, b) => (b.income + b.expense) - (a.income + a.expense));
  }, [yearTx]);

  // Monthly breakdown
  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, { income: number; expense: number }> = {};
    yearTx.forEach((tx) => {
      const m = tx.date.slice(0, 7); // YYYY-MM
      if (!map[m]) map[m] = { income: 0, expense: 0 };
      if (tx.type === "income") map[m].income += tx.amount;
      else map[m].expense += tx.amount;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [yearTx]);

  // Available years
  const years = useMemo(() => {
    const set = new Set(transactions.map((tx) => new Date(tx.date).getFullYear()));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [transactions]);

  // Export handlers
  const handleExportTransactions = () => {
    if (exportFormat === "csv") {
      const header = ["Date", "Type", "Category", "Description", "Merchant", "Amount (UGX)"];
      const rows = yearTx.map((tx) => [tx.date, tx.type, tx.category, tx.description, tx.merchant, String(tx.amount)]);
      downloadCSV(`uniguard_transactions_${year}.csv`, [header, ...rows]);
    } else {
      downloadJSON(`uniguard_transactions_${year}.json`, yearTx);
    }
  };

  const handleExportSummary = () => {
    const summary = {
      year,
      totalIncome,
      totalExpenses,
      netIncome,
      transactionCount: txCount,
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        totalIncome: c.income,
        totalExpenses: c.expense,
        transactionCount: c.count,
      })),
      monthlyBreakdown: monthlyBreakdown.map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expense,
        net: data.income - data.expense,
      })),
    };
    if (exportFormat === "csv") {
      const header = ["Month", "Income", "Expenses", "Net"];
      const rows = monthlyBreakdown.map(([m, d]) => [m, String(d.income), String(d.expense), String(d.income - d.expense)]);
      downloadCSV(`uniguard_tax_summary_${year}.csv`, [header, ...rows]);
    } else {
      downloadJSON(`uniguard_tax_summary_${year}.json`, summary);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-6 space-y-6">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              Tax & Export
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Prepare tax data and export financial records</p>
          </div>
        </motion.header>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm"
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as "csv" | "json")}
              className="px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={handleExportTransactions} disabled={yearTx.length === 0}>
              <Download className="w-4 h-4 mr-1" /> Export Transactions
            </Button>
            <Button className="bg-gradient-primary" onClick={handleExportSummary} disabled={yearTx.length === 0}>
              <Download className="w-4 h-4 mr-1" /> Export Tax Summary
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
            <p className="text-muted-foreground">Loading financial data...</p>
          </div>
        ) : (
          <>
            {/* Year Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Income</p>
                <p className="font-mono text-2xl font-bold text-success">{formatCurrency(totalIncome)}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Expenses</p>
                <p className="font-mono text-2xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Net Income</p>
                <p className={cn("font-mono text-2xl font-bold", netIncome >= 0 ? "text-success" : "text-destructive")}>{formatCurrency(netIncome)}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Transactions</p>
                <p className="font-mono text-2xl font-bold text-primary">{txCount}</p>
              </motion.div>
            </div>

            {/* Monthly Breakdown */}
            {monthlyBreakdown.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Monthly Breakdown — {year}</h3>
                <div className="space-y-2">
                  {monthlyBreakdown.map(([month, data]) => {
                    const net = data.income - data.expense;
                    return (
                      <div key={month} className="flex items-center gap-3 p-2 rounded-lg bg-muted/10">
                        <span className="text-xs font-mono text-muted-foreground w-16">{month.slice(5)}/{month.slice(2, 4)}</span>
                        <div className="flex-1 flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1 text-success">
                            <TrendingUp className="w-3 h-3" /> {formatCurrency(data.income)}
                          </span>
                          <span className="flex items-center gap-1 text-destructive">
                            <TrendingDown className="w-3 h-3" /> {formatCurrency(data.expense)}
                          </span>
                        </div>
                        <span className={cn("font-mono text-xs font-bold", net >= 0 ? "text-success" : "text-destructive")}>
                          {net >= 0 ? "+" : ""}{formatCurrency(net)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Category Breakdown */}
            {categoryBreakdown.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Category Breakdown — {year}</h3>
                <div className="space-y-2">
                  {categoryBreakdown.map((cat) => (
                    <div key={cat.category} className="flex items-center justify-between p-2 rounded-lg bg-muted/10">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm text-foreground">{cat.category}</span>
                        <span className="text-[10px] text-muted-foreground">{cat.count} txn</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        {cat.income > 0 && <span className="text-success">+{formatCurrency(cat.income)}</span>}
                        {cat.expense > 0 && <span className="text-destructive">-{formatCurrency(cat.expense)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {yearTx.length === 0 && (
              <div className="glass-card rounded-xl p-8 text-center">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-foreground font-medium">No transactions for {year}</p>
                <p className="text-muted-foreground text-sm">Add transactions to generate tax reports.</p>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
