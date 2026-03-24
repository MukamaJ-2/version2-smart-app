import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Filter,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  PieChart,
  LineChart,
  ShoppingBag,
  Car,
  Zap,
  Coffee,
  Utensils,
  CheckCircle,
  AlertTriangle,
  Info,
  Sparkles,
  ChevronDown,
  FileText,
} from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart as RechartsLineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { aiService, type AIInsight } from "@/lib/ai/ai-service";
import TypicalSpendCard from "@/components/dashboard/TypicalSpendCard";
import { jsPDF } from "jspdf";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { TrainingTransaction } from "@/lib/ai/training-data";

/* ───────── Types ───────── */

interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  time: string;
}

interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
}

/* ───────── Category Colors ───────── */

const CATEGORY_COLORS: Record<string, string> = {
  Rent: "#10b981",
  Utilities: "#eab308",
  Food: "#22c55e",
  "Eating Out": "#f97316",
  Education: "#6366f1",
  Communication: "#0ea5e9",
  Clothing: "#ec4899",
  Entertainment: "#a855f7",
  "Personal Care": "#f43f5e",
  Savings: "#22c55e",
  "Gifts / Donations": "#f59e0b",
  Insurance: "#06b6d4",
  "Debt Payments": "#ef4444",
  Miscellaneous: "#8b5cf6",
  Dining: "#f97316",
  Shopping: "#ec4899",
  Transport: "#3b82f6",
  Coffee: "#f59e0b",
  Housing: "#10b981",
  Tech: "#a855f7",
  Travel: "#06b6d4",
  Health: "#f43f5e",
  Income: "#22c55e",
};

const GOAL_COLORS = ["bg-primary", "bg-success", "bg-secondary", "bg-warning", "bg-destructive"];

/* ───────── Helpers ───────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(amount);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ───────── Data computation helpers ───────── */

function computeMonthlyData(transactions: Transaction[]) {
  const grouped: Record<string, { income: number; expenses: number }> = {};

  transactions.forEach((tx) => {
    const d = new Date(tx.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!grouped[key]) grouped[key] = { income: 0, expenses: 0 };
    if (tx.type === "income") grouped[key].income += tx.amount;
    else grouped[key].expenses += tx.amount;
  });

  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const [, monthIdx] = key.split("-");
      return {
        month: MONTH_NAMES[parseInt(monthIdx, 10)] || key,
        income: data.income,
        expenses: data.expenses,
        savings: data.income - data.expenses,
      };
    });
}

function computeCategoryData(transactions: Transaction[]) {
  const grouped: Record<string, number> = {};
  transactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      grouped[tx.category] = (grouped[tx.category] || 0) + tx.amount;
    });

  return Object.entries(grouped)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || "#8b5cf6",
    }));
}

function computeWeeklyData(transactions: Transaction[]) {
  // Last 7 days spending grouped by day of week
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

  const dayTotals: Record<string, number> = {};
  DAY_NAMES.forEach((d) => (dayTotals[d] = 0));

  transactions
    .filter((tx) => {
      const d = new Date(tx.date);
      return tx.type === "expense" && d >= sevenDaysAgo && d <= now;
    })
    .forEach((tx) => {
      const dayName = DAY_NAMES[new Date(tx.date).getDay()];
      dayTotals[dayName] += tx.amount;
    });

  // Re-order starting from Monday
  const orderedDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return orderedDays.map((day) => ({ day, amount: dayTotals[day] || 0 }));
}

function computeMerchantData(transactions: Transaction[]) {
  const grouped: Record<string, { amount: number; count: number; category: string }> = {};

  transactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      const key = tx.description;
      if (!grouped[key]) grouped[key] = { amount: 0, count: 0, category: tx.category };
      grouped[key].amount += tx.amount;
      grouped[key].count += 1;
    });

  return Object.entries(grouped)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .slice(0, 10)
    .map(([name, data]) => ({
      name,
      amount: data.amount,
      transactions: data.count,
      category: data.category,
    }));
}

function computeInsightCards(transactions: Transaction[]) {
  const expenses = transactions.filter((tx) => tx.type === "expense");
  const incomes = transactions.filter((tx) => tx.type === "income");

  const totalExpenses = expenses.reduce((s, tx) => s + tx.amount, 0);
  const totalIncome = incomes.reduce((s, tx) => s + tx.amount, 0);

  // Spending trend (current month vs previous month)
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const thisMonthExpenses = expenses
    .filter((tx) => {
      const d = new Date(tx.date);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    })
    .reduce((s, tx) => s + tx.amount, 0);

  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const lastMonthExpenses = expenses
    .filter((tx) => {
      const d = new Date(tx.date);
      return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    })
    .reduce((s, tx) => s + tx.amount, 0);

  const spendingChangeRaw = lastMonthExpenses > 0 ? ((thisMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 : 0;
  const spendingChange = Math.min(999, Math.max(-999, spendingChangeRaw));

  // Savings rate (0–100; negative = overspending)
  const savingsRateRaw = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const savingsRate = Math.min(100, Math.max(0, Math.round(savingsRateRaw)));

  // Top category
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((tx) => {
    categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
  });
  const topCategory = Object.entries(categoryTotals).sort(([, a], [, b]) => b - a)[0];

  // Average daily spend (this week)
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekExpenses = expenses
    .filter((tx) => new Date(tx.date) >= weekAgo)
    .reduce((s, tx) => s + tx.amount, 0);
  const avgDaily = Math.round(weekExpenses / 7);

  return [
    {
      title: "Spending Trend",
      value: `${spendingChange >= 0 ? "+" : ""}${spendingChange.toFixed(0)}%`,
      change: "vs last month",
      isPositive: spendingChange <= 0,
      icon: spendingChange <= 0 ? TrendingDown : TrendingUp,
      color: spendingChange <= 0 ? "text-success" : "text-destructive",
    },
    {
      title: "Savings Rate",
      value: `${savingsRate}%`,
      change: "of income",
      isPositive: savingsRate >= 20,
      icon: TrendingUp,
      color: savingsRate >= 20 ? "text-success" : "text-destructive",
    },
    {
      title: "Top Category",
      value: topCategory ? topCategory[0] : "N/A",
      change: topCategory ? `${formatCurrency(topCategory[1])} spent` : "No data",
      isPositive: null as boolean | null,
      icon: DollarSign,
      color: "text-primary",
    },
    {
      title: "Avg Daily Spend",
      value: formatCurrency(avgDaily),
      change: "this week",
      isPositive: null as boolean | null,
      icon: Calendar,
      color: "text-accent",
    },
  ];
}

/* ───────── Component ───────── */

export default function Reports() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"week" | "month" | "year">("month");
  const [showFilters, setShowFilters] = useState(false);
  const [dynamicInsights, setDynamicInsights] = useState<AIInsight[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch transactions and goals from Supabase
  useEffect(() => {
    let isActive = true;
    const loadData = async () => {
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

      // Fetch transactions
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("id,description,amount,type,category,date,time")
        .eq("user_id", userData.user.id)
        .order("date", { ascending: true });
      if (!isActive) return;
      if (!txError && txData) {
        setTransactions(txData as Transaction[]);
      }

      // Fetch goals
      const { data: goalData, error: goalError } = await supabase
        .from("goals")
        .select("id,name,target_amount,current_amount")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      if (!goalError && goalData) {
        setGoals(goalData as GoalRow[]);
      }

      setIsLoading(false);
    };
    loadData();
    return () => {
      isActive = false;
    };
  }, []);

  // Compute chart data from real transactions
  const monthlyData = useMemo(() => computeMonthlyData(transactions), [transactions]);
  const categoryData = useMemo(() => computeCategoryData(transactions), [transactions]);
  const weeklyData = useMemo(() => computeWeeklyData(transactions), [transactions]);
  const merchantSpending = useMemo(() => computeMerchantData(transactions), [transactions]);
  const insightCards = useMemo(() => computeInsightCards(transactions), [transactions]);

  const goalProgress = useMemo(
    () =>
      goals.map((g, i) => ({
        name: g.name,
        current: g.current_amount,
        target: g.target_amount,
        color: GOAL_COLORS[i % GOAL_COLORS.length],
      })),
    [goals]
  );

  // Time-range filtering for monthly data
  const monthlyWindow = useMemo(() => {
    if (timeRange === "year") return monthlyData;
    if (timeRange === "month") return monthlyData.slice(-3);
    return monthlyData.slice(-1);
  }, [monthlyData, timeRange]);

  const totalIncome = monthlyWindow.reduce((sum, d) => sum + d.income, 0);
  const totalExpenses = monthlyWindow.reduce((sum, d) => sum + d.expenses, 0);

  // Income growth rate calculation (clamped to ±999%)
  const incomeGrowth = useMemo(() => {
    if (monthlyData.length < 2) return 0;
    const prev = monthlyData[monthlyData.length - 2]?.income || 1;
    const curr = monthlyData[monthlyData.length - 1]?.income || 0;
    const raw = ((curr - prev) / prev) * 100;
    return Math.min(999, Math.max(-999, raw));
  }, [monthlyData]);

  // Expense change rate (clamped to ±999%)
  const expenseChange = useMemo(() => {
    if (monthlyData.length < 2) return 0;
    const prev = monthlyData[monthlyData.length - 2]?.expenses || 1;
    const curr = monthlyData[monthlyData.length - 1]?.expenses || 0;
    const raw = ((curr - prev) / prev) * 100;
    return Math.min(999, Math.max(-999, raw));
  }, [monthlyData]);

  // AI insights calculation using real data
  const calculateInsights = () => {
    setIsCalculating(true);
    setTimeout(() => {
      const trainingData: TrainingTransaction[] = transactions.map((tx) => ({
        description: tx.description,
        amount: tx.amount,
        category: tx.category,
        type: tx.type,
        date: tx.date,
      }));

      const incomeTotal = transactions
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + tx.amount, 0);

      aiService.initialize(trainingData, incomeTotal);
      const fetchedInsights = aiService.getReportInsights();
      setDynamicInsights(fetchedInsights);
      setIsCalculating(false);

      if (fetchedInsights.length > 0) {
        toast({
          title: "Highlights updated",
          description: `Using ${transactions.length} transactions.`,
        });
      }
    }, 400);
  };

  // Calculate insights once transactions are loaded
  useEffect(() => {
    if (transactions.length > 0) {
      calculateInsights();
    }
  }, [transactions.length]);

  const exportReport = () => {
    const rows: string[][] = [];
    rows.push([`Report Export (${timeRange})`]);
    rows.push([]);
    rows.push(["Monthly Summary"]);
    rows.push(["Month", "Income", "Expenses", "Savings"]);
    monthlyWindow.forEach((row) => {
      rows.push([row.month, row.income.toString(), row.expenses.toString(), row.savings.toString()]);
    });
    rows.push([]);
    rows.push(["Weekly Spending"]);
    rows.push(["Day", "Amount"]);
    weeklyData.forEach((row) => {
      rows.push([row.day, row.amount.toString()]);
    });
    rows.push([]);
    rows.push(["Category Distribution"]);
    rows.push(["Category", "Amount"]);
    categoryData.forEach((row) => {
      rows.push([row.name, row.value.toString()]);
    });
    rows.push([]);
    rows.push(["Top Merchants"]);
    rows.push(["Merchant", "Category", "Transactions", "Total"]);
    merchantSpending.forEach((m) => {
      rows.push([m.name, m.category, m.transactions.toString(), m.amount.toString()]);
    });

    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `uniguard-wallet-report-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Report exported",
      description: "Your CSV report has been downloaded.",
    });
  };

  const exportReportPDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    const addTitle = (text: string, fontSize = 18) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "bold");
      doc.text(text, 20, y);
      y += fontSize / 2 + 4;
    };

    const addText = (text: string, fontSize = 10) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal");
      doc.text(text, 20, y);
      y += 6;
    };

    const addTable = (headers: string[], rows: string[][], colWidths?: number[]) => {
      const colCount = headers.length;
      const defaultWidth = (pageWidth - 40) / colCount;
      const widths = colWidths ?? headers.map(() => defaultWidth);
      const startX = 20;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      let x = startX;
      headers.forEach((h, i) => {
        doc.text(h, x, y);
        x += widths[i];
      });
      y += 6;

      doc.setFont("helvetica", "normal");
      rows.forEach((row) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        x = startX;
        row.forEach((cell, i) => {
          const text = String(cell).slice(0, 35);
          doc.text(text, x, y);
          x += widths[i];
        });
        y += 5;
      });
      y += 6;
    };

    addTitle("UniGuard Financial Report", 20);
    addText(`Generated: ${new Date().toLocaleDateString("en-UG", { dateStyle: "full" })}`);
    addText(`Period: ${timeRange}`);
    y += 4;

    addTitle("Summary", 14);
    addText(`Total Income: ${formatCurrency(totalIncome)}`);
    addText(`Total Expenses: ${formatCurrency(totalExpenses)}`);
    addText(`Net Savings: ${formatCurrency(Math.max(0, totalIncome - totalExpenses))}`);
    addText(`Savings Rate: ${totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0}%`);
    y += 6;

    addTitle("Monthly Summary", 12);
    addTable(
      ["Month", "Income", "Expenses", "Savings"],
      monthlyWindow.map((r) => [
        r.month,
        formatCurrency(r.income),
        formatCurrency(r.expenses),
        formatCurrency(r.savings),
      ]),
      [30, 45, 45, 45]
    );

    addTitle("Category Distribution", 12);
    addTable(
      ["Category", "Amount"],
      categoryData.map((r) => [r.name, formatCurrency(r.value)]),
      [80, 80]
    );

    addTitle("Top Merchants", 12);
    addTable(
      ["Merchant", "Category", "Txns", "Total"],
      merchantSpending.map((m) => [
        m.name.slice(0, 25),
        m.category,
        String(m.transactions),
        formatCurrency(m.amount),
      ]),
      [60, 40, 20, 45]
    );

    doc.save(`uniguard-financial-report-${timeRange}-${new Date().toISOString().split("T")[0]}.pdf`);

    toast({
      title: "PDF exported",
      description: "Your financial report has been downloaded as PDF.",
    });
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-sm">
                <BarChart3 className="w-6 h-6 text-primary-foreground" />
              </div>
              Financial Reports
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Comprehensive analytics and insights
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="glass-card border-border hover:border-primary/50 gap-2 touch-manipulation min-h-[44px]"
              onClick={calculateInsights}
              disabled={isCalculating || transactions.length === 0}
            >
              <Sparkles className={cn("w-4 h-4 text-primary", isCalculating && "animate-spin")} />
              {isCalculating ? "Recalculating..." : "Recalculate AI"}
            </Button>
            <Button
              variant="outline"
              className="border-border hover:border-primary/50 gap-2"
              onClick={() => setShowFilters(true)}
            >
              <Filter className="w-4 h-4" />
              Filter
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="bg-gradient-primary hover:opacity-90 gap-2"
                  disabled={transactions.length === 0}
                >
                  <Download className="w-4 h-4" />
                  Export
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={exportReport} disabled={transactions.length === 0}>
                  <FileText className="w-4 h-4 mr-2" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportReportPDF} disabled={transactions.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.header>

        {isLoading && (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground animate-pulse">Loading your financial data...</p>
          </div>
        )}

        {!isLoading && transactions.length === 0 && (
          <div className="glass-card rounded-xl p-8 text-center space-y-2">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/50" />
            <p className="text-foreground font-medium">No transaction data yet</p>
            <p className="text-muted-foreground text-sm">
              Add transactions to see your financial reports and insights here.
            </p>
          </div>
        )}

        {!isLoading && transactions.length > 0 && (
          <>
            {/* Summary Cards — Dynamically computed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {insightCards.map((insight, index) => {
                const Icon = insight.icon;
                return (
                  <motion.div
                    key={insight.title}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    whileHover={{ scale: 1.02 }}
                    className="glass-card rounded-xl p-4 hover:glass-card-glow transition-all cursor-default border-border/50"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn("p-2 rounded-lg bg-muted/50", insight.isPositive === true && "bg-success/10", insight.isPositive === false && "bg-destructive/10")}>
                        <Icon className={cn("w-4 h-4", insight.color)} />
                      </div>
                      {insight.isPositive !== null && (
                        <div className={cn("flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          insight.isPositive ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive")}>
                          {insight.isPositive ? (
                            <>
                              <ArrowUpRight className="w-3 h-3" />
                              UP
                            </>
                          ) : (
                            <>
                              <ArrowDownLeft className="w-3 h-3" />
                              DOWN
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em] mb-1">
                      {insight.title}
                    </p>
                    <p className={cn("font-display text-2xl font-black mb-1 tracking-tight text-glow-sm", insight.color)}>
                      {insight.value}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground/80 italic">{insight.change}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Typical Spend (Budget Suggestions) */}
            <TypicalSpendCard transactions={transactions} />

            {/* Main Charts */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="glass-card">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="expenses">Expenses</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="merchants">Merchants</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Income vs Expenses Line Chart */}
                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LineChart className="w-5 h-5 text-primary" />
                      Income vs Expenses Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsLineChart data={monthlyWindow}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="income" stroke="hsl(var(--success))" strokeWidth={2} dot={{ fill: "hsl(var(--success))", r: 4 }} name="Income" />
                        <Line type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ fill: "hsl(var(--destructive))", r: 4 }} name="Expenses" />
                        <Line type="monotone" dataKey="savings" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} name="Savings" />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Weekly Spending Bar Chart */}
                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-primary" />
                      Weekly Spending Pattern
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsBarChart data={weeklyData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                        <YAxis stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="income" className="space-y-6">
                {/* AI Insights Section */}
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em] flex items-center gap-2">
                    <Sparkles className="w-3 h-3 text-primary" />
                    Money highlights
                  </p>
                  <div className="text-[10px] font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/30">
                    From {transactions.length} transactions
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                  {isCalculating && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[2px] rounded-xl">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="w-8 h-8 text-primary" />
                      </motion.div>
                    </div>
                  )}
                  {dynamicInsights.map((insight) => (
                    <motion.div
                      key={insight.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -5 }}
                      className={cn(
                        "glass-card p-4 rounded-xl relative overflow-hidden",
                        insight.type === "positive" && "border-success/30 shadow-glow-success/10",
                        insight.type === "warning" && "border-warning/30 shadow-glow-warning/10",
                        insight.type === "info" && "border-primary/30 shadow-glow-sm/10"
                      )}
                    >
                      <div className="absolute top-0 right-0 p-3 opacity-10">
                        <Sparkles className="w-12 h-12" />
                      </div>
                      <div className="flex items-start gap-3 relative z-10">
                        <div className={cn(
                          "p-2 rounded-lg",
                          insight.type === "positive" && "bg-success/20 text-success",
                          insight.type === "warning" && "bg-warning/20 text-warning",
                          insight.type === "info" && "bg-primary/20 text-primary"
                        )}>
                          {insight.type === "positive" && <CheckCircle className="w-5 h-5" />}
                          {insight.type === "warning" && <AlertTriangle className="w-5 h-5" />}
                          {insight.type === "info" && <Info className="w-5 h-5" />}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-relaxed">
                            {insight.message}
                          </p>
                          {insight.actionPath ? (
                            <Link
                              to={insight.actionPath}
                              className="inline-block text-xs font-bold uppercase tracking-wider text-primary hover:underline"
                            >
                              {insight.action} →
                            </Link>
                          ) : (
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                              {insight.action}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="glass-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">Total Income</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-mono text-2xl font-bold text-success">
                        {formatCurrency(totalIncome)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Selected range</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">Average Monthly</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-mono text-2xl font-bold text-foreground">
                        {formatCurrency(monthlyData.length > 0 ? totalIncome / monthlyData.length : 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Average</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">Growth Rate</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={cn("font-mono text-2xl font-bold", incomeGrowth >= 0 ? "text-success" : "text-destructive")}>
                        {incomeGrowth >= 0 ? "+" : ""}{incomeGrowth.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">vs previous period</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="expenses" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="glass-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-mono text-2xl font-bold text-destructive">
                        {formatCurrency(totalExpenses)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Selected range</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">Average Monthly</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-mono text-2xl font-bold text-foreground">
                        {formatCurrency(monthlyData.length > 0 ? totalExpenses / monthlyData.length : 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Average</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card border-border">
                    <CardHeader>
                      <CardTitle className="text-sm text-muted-foreground">Change</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className={cn("font-mono text-2xl font-bold", expenseChange <= 0 ? "text-success" : "text-destructive")}>
                        {expenseChange >= 0 ? "+" : ""}{expenseChange.toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">vs previous period</p>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="categories" className="space-y-6">
                <Card className="glass-card border-border">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-primary" />
                      Expense Distribution by Category
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {categoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <RechartsPieChart>
                            <Pie
                              data={categoryData}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              outerRadius={100}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {categoryData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px",
                              }}
                              formatter={(value: number) => formatCurrency(value)}
                            />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                          No expense data available
                        </div>
                      )}
                      <div className="space-y-3">
                        {categoryData.map((category) => (
                          <div key={category.name} className="flex items-center justify-between p-3 glass-card rounded-lg hover:glass-card-glow transition-all group">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: category.color }}
                              />
                              <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{category.name}</span>
                            </div>
                            <span className="font-mono text-sm font-bold text-foreground">
                              {formatCurrency(category.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Savings Goals Progress */}
                {goalProgress.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {goalProgress.map((goal) => (
                      <Card key={goal.name} className="glass-card border-border overflow-hidden group hover:glass-card-glow transition-all">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium flex justify-between items-center group-hover:text-primary transition-colors">
                            {goal.name}
                            <span className="text-xs text-muted-foreground">
                              {goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0}%
                            </span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div className="w-full bg-muted/30 rounded-full h-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0}%` }}
                                transition={{ duration: 1.5, ease: "circOut" }}
                                className={cn("h-full", goal.color)}
                              />
                            </div>
                            <div className="flex justify-between items-end">
                              <div className="text-xs text-muted-foreground">
                                Saved: <span className="font-mono font-bold text-foreground">{formatCurrency(goal.current)}</span>
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                Target: {formatCurrency(goal.target)}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="merchants" className="space-y-6">
                <Card className="glass-card border-border overflow-hidden">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingBag className="w-5 h-5 text-primary" />
                      Top Merchants
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {merchantSpending.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-border bg-muted/20">
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Merchant</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider">Category</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">Transactions</th>
                              <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-right">Total Spent</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/50">
                            {merchantSpending.map((merchant) => (
                              <tr key={merchant.name} className="hover:bg-primary/5 transition-colors group">
                                <td className="px-6 py-4">
                                  <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                                    {merchant.name}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    {merchant.category === "Transport" && <Car className="w-3 h-3" />}
                                    {(merchant.category === "Groceries" || merchant.category === "Shopping" || merchant.category === "Food") && <ShoppingBag className="w-3 h-3" />}
                                    {merchant.category === "Utilities" && <Zap className="w-3 h-3" />}
                                    {(merchant.category === "Dining" || merchant.category === "Eating Out") && <Utensils className="w-3 h-3" />}
                                    {merchant.category === "Coffee" && <Coffee className="w-3 h-3" />}
                                    {merchant.category}
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-sm text-muted-foreground">
                                  {merchant.transactions}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-bold text-foreground">
                                  {formatCurrency(merchant.amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No merchant data available yet
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        <Dialog open={showFilters} onOpenChange={setShowFilters}>
          <DialogContent className="glass-card border-border">
            <DialogHeader>
              <DialogTitle>Filter Reports</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">
                  Time Range
                </label>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as "week" | "month" | "year")}
                  className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowFilters(false)}>
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
