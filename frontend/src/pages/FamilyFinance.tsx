import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  UserPlus,
  Wallet,
  TrendingUp,
  PieChart,
  Edit2,
  Trash2,
  AlertTriangle,
  Gift,
  DollarSign,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ───────── Types ───────── */

interface FamilyMember {
  id: string;
  name: string;
  role: "parent" | "spouse" | "child" | "other";
  avatar: string;
  monthlyAllowance: number;
  totalSpent: number;
  color: string;
}

interface FamilyExpense {
  id: string;
  description: string;
  amount: number;
  date: string;
  memberId: string;
  category: string;
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

const ROLE_COLORS = ["#00d4ff", "#a855f7", "#22c55e", "#f59e0b", "#ef4444", "#ec4899"];
const ROLE_AVATARS: Record<string, string> = {
  parent: "👨",
  spouse: "👩",
  child: "🧒",
  other: "👤",
};
const STORAGE_KEY = "uniguard.familyFinance";

function loadData(): { members: FamilyMember[]; expenses: FamilyExpense[] } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{"members":[],"expenses":[]}');
  } catch {
    return { members: [], expenses: [] };
  }
}

function saveData(members: FamilyMember[], expenses: FamilyExpense[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ members, expenses }));
}

/* ───────── Page ───────── */

export default function FamilyFinance() {
  const initial = loadData();
  const [members, setMembers] = useState<FamilyMember[]>(initial.members);
  const [expenses, setExpenses] = useState<FamilyExpense[]>(initial.expenses);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Form states
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<FamilyMember["role"]>("child");
  const [newAllowance, setNewAllowance] = useState("");

  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expMember, setExpMember] = useState("");
  const [expCategory, setExpCategory] = useState("General");

  const persist = (m: FamilyMember[], e: FamilyExpense[]) => {
    setMembers(m);
    setExpenses(e);
    saveData(m, e);
  };

  const addMember = () => {
    if (!newName.trim()) return;
    const member: FamilyMember = {
      id: genId(),
      name: newName.trim(),
      role: newRole,
      avatar: ROLE_AVATARS[newRole],
      monthlyAllowance: Number(newAllowance) || 0,
      totalSpent: 0,
      color: ROLE_COLORS[members.length % ROLE_COLORS.length],
    };
    persist([...members, member], expenses);
    setNewName("");
    setNewAllowance("");
    setShowAddMember(false);
  };

  const removeMember = (id: string) => {
    persist(
      members.filter((m) => m.id !== id),
      expenses.filter((e) => e.memberId !== id)
    );
  };

  const addExpense = () => {
    if (!expDesc.trim() || !expAmount || !expMember) return;
    const expense: FamilyExpense = {
      id: genId(),
      description: expDesc.trim(),
      amount: Number(expAmount),
      date: new Date().toISOString().slice(0, 10),
      memberId: expMember,
      category: expCategory,
    };
    // Update member totalSpent
    const updated = members.map((m) =>
      m.id === expMember ? { ...m, totalSpent: m.totalSpent + Number(expAmount) } : m
    );
    persist(updated, [...expenses, expense]);
    setExpDesc("");
    setExpAmount("");
    setExpMember("");
    setShowAddExpense(false);
  };

  // Stats
  const totalBudget = members.reduce((s, m) => s + m.monthlyAllowance, 0);
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0);
  const topSpender = members.length > 0
    ? [...members].sort((a, b) => b.totalSpent - a.totalSpent)[0]
    : null;

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              Family Finance
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Manage family budgets and track spending together</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddMember(true)}>
              <UserPlus className="w-4 h-4 mr-1" /> Add Member
            </Button>
            <Button className="bg-gradient-primary" onClick={() => setShowAddExpense(true)} disabled={members.length === 0}>
              <Plus className="w-4 h-4 mr-1" /> Add Expense
            </Button>
          </div>
        </motion.header>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Family Members</p>
            <p className="font-mono text-2xl font-bold text-foreground">{members.length}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Budget</p>
            <p className="font-mono text-2xl font-bold text-primary">{formatCurrency(totalBudget)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Spent</p>
            <p className="font-mono text-2xl font-bold text-destructive">{formatCurrency(totalSpent)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Top Spender</p>
            <p className="font-mono text-lg font-bold text-warning">{topSpender ? `${topSpender.avatar} ${topSpender.name}` : "—"}</p>
          </motion.div>
        </div>

        {/* Add Member Modal */}
        <AnimatePresence>
          {showAddMember && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setShowAddMember(false)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-foreground mb-4">Add Family Member</h3>
                <div className="space-y-3">
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="w-full px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                  <select value={newRole} onChange={(e) => setNewRole(e.target.value as FamilyMember["role"])} className="w-full px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm">
                    <option value="parent">Parent</option>
                    <option value="spouse">Spouse</option>
                    <option value="child">Child</option>
                    <option value="other">Other</option>
                  </select>
                  <input value={newAllowance} onChange={(e) => setNewAllowance(e.target.value)} type="number" placeholder="Monthly allowance (UGX)" className="w-full px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowAddMember(false)}>Cancel</Button>
                    <Button className="flex-1 bg-gradient-primary" onClick={addMember}>Add</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Expense Modal */}
        <AnimatePresence>
          {showAddExpense && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setShowAddExpense(false)}>
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="glass-card rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <h3 className="font-semibold text-foreground mb-4">Add Family Expense</h3>
                <div className="space-y-3">
                  <input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Description" className="w-full px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                  <input value={expAmount} onChange={(e) => setExpAmount(e.target.value)} type="number" placeholder="Amount (UGX)" className="w-full px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none" />
                  <select value={expMember} onChange={(e) => setExpMember(e.target.value)} className="w-full px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm">
                    <option value="">Select member...</option>
                    {members.map((m) => (<option key={m.id} value={m.id}>{m.avatar} {m.name}</option>))}
                  </select>
                  <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="w-full px-3 py-2 bg-muted/30 rounded-lg border border-border text-foreground text-sm">
                    {["General", "Food", "Education", "Transport", "Entertainment", "Healthcare", "Clothing", "Utilities"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowAddExpense(false)}>Cancel</Button>
                    <Button className="flex-1 bg-gradient-primary" onClick={addExpense}>Add Expense</Button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Member Cards */}
        {members.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-foreground font-medium">No family members yet</p>
            <p className="text-muted-foreground text-sm">Add family members to start tracking shared finances.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {members.map((member, idx) => {
              const memberExpenses = expenses.filter((e) => e.memberId === member.id);
              const spent = memberExpenses.reduce((s, e) => s + e.amount, 0);
              const pct = member.monthlyAllowance > 0 ? (spent / member.monthlyAllowance) * 100 : 0;
              const isOver = pct > 100;

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={cn(
                    "glass-card rounded-2xl p-5 border transition-all",
                    isOver ? "border-destructive/30" : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ backgroundColor: member.color + "20" }}>
                        {member.avatar}
                      </div>
                      <div>
                        <h3 className="font-semibold text-foreground">{member.name}</h3>
                        <span className="text-xs text-muted-foreground capitalize">{member.role}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeMember(member.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Budget bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Spent: {formatCurrency(spent)}</span>
                      <span className="text-muted-foreground">Budget: {formatCurrency(member.monthlyAllowance)}</span>
                    </div>
                    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(pct, 100)}%` }}
                        className={cn("h-full rounded-full", isOver ? "bg-destructive" : pct > 75 ? "bg-warning" : "bg-success")}
                      />
                    </div>
                    <p className="text-right text-xs font-mono" style={{ color: member.color }}>{pct.toFixed(0)}% used</p>
                  </div>

                  {isOver && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/5 rounded-lg px-2 py-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Over budget by {formatCurrency(spent - member.monthlyAllowance)}
                    </div>
                  )}

                  {/* Recent expenses */}
                  {memberExpenses.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recent</p>
                      {memberExpenses.slice(-3).map((exp) => (
                        <div key={exp.id} className="flex justify-between text-xs">
                          <span className="text-foreground truncate">{exp.description}</span>
                          <span className="font-mono text-muted-foreground shrink-0 ml-2">{formatCurrency(exp.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
