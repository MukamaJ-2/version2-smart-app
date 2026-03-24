import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lock, Unlock, Plus, Vault, TrendingUp, Clock,
  AlertTriangle, Trash2, Sparkles, Loader2,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ───────── Types ───────── */

interface VaultItem {
  id: string;
  name: string;
  amount: number;
  lock_days: number;
  created_at: string;
  unlock_date: string;
  status: "locked" | "unlocked" | "broken";
  interest_rate: number;
}

/* ───────── Helpers ───────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(amount);
}

function generateId(): string {
  return `vault-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function computeProjectedGrowth(amount: number, annualRate: number, days: number): number {
  return Math.round(amount * Math.pow(1 + annualRate / 365, days));
}

function getDaysRemaining(unlockDate: string): number {
  return Math.max(0, Math.ceil((new Date(unlockDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
}

function getProgressPercent(createdAt: string, unlockDate: string): number {
  const total = new Date(unlockDate).getTime() - new Date(createdAt).getTime();
  const elapsed = Date.now() - new Date(createdAt).getTime();
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, (elapsed / total) * 100));
}

const LOCK_OPTIONS = [
  { days: 30, label: "30 Days", rate: 0.08 },
  { days: 60, label: "60 Days", rate: 0.10 },
  { days: 90, label: "90 Days", rate: 0.12 },
];

/* ───────── VaultCard ───────── */

function VaultCard({ item, onBreak, onDelete }: { item: VaultItem; onBreak: () => void; onDelete: () => void }) {
  const daysLeft = getDaysRemaining(item.unlock_date);
  const progress = getProgressPercent(item.created_at, item.unlock_date);
  const projected = computeProjectedGrowth(item.amount, item.interest_rate, item.lock_days);
  const isUnlocked = item.status === "unlocked" || (item.status === "locked" && daysLeft === 0);
  const isBroken = item.status === "broken";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        "glass-card rounded-2xl p-5 border transition-all",
        isUnlocked && "border-success/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]",
        isBroken && "border-destructive/30 opacity-75",
        !isUnlocked && !isBroken && "border-border hover:glass-card-glow"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", isUnlocked ? "bg-success/10" : isBroken ? "bg-destructive/10" : "bg-primary/10")}>
            {isUnlocked ? <Unlock className="w-5 h-5 text-success" /> : isBroken ? <AlertTriangle className="w-5 h-5 text-destructive" /> : <Lock className="w-5 h-5 text-primary" />}
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{item.name}</h3>
            <p className="text-xs text-muted-foreground">{item.lock_days}-day lock · {Math.round(item.interest_rate * 100)}% APY</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold text-foreground">{formatCurrency(item.amount)}</p>
          {!isBroken && <p className="text-xs text-success font-mono"><TrendingUp className="w-3 h-3 inline mr-0.5" />{formatCurrency(projected)} projected</p>}
        </div>
      </div>

      {!isUnlocked && !isBroken && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{daysLeft} days left</span>
            <span className="font-mono">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div className="h-full bg-gradient-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1 }} />
          </div>
        </div>
      )}

      {isUnlocked && !isBroken && (
        <div className="mt-3 p-2 rounded-lg bg-success/10 border border-success/20 text-center">
          <p className="text-xs text-success font-medium">Vault unlocked! Funds available.</p>
        </div>
      )}
      {isBroken && (
        <div className="mt-3 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
          <p className="text-xs text-destructive font-medium">Broken early — no interest earned</p>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/50">
        {!isUnlocked && !isBroken && (
          <Button variant="outline" size="sm" className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={onBreak}>
            <AlertTriangle className="w-3.5 h-3.5 mr-1" /> Break Vault
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></Button>
      </div>
    </motion.div>
  );
}

/* ───────── Main Page ───────── */

export default function SavingsVault() {
  const [vaults, setVaults] = useState<VaultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [confirmBreak, setConfirmBreak] = useState<string | null>(null);
  const [breakText, setBreakText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newLockIdx, setNewLockIdx] = useState(0);
  const [useCustom, setUseCustom] = useState(false);
  const [customUnlockDate, setCustomUnlockDate] = useState("");
  const [customApy, setCustomApy] = useState("");

  /* ── Load from Supabase on mount ── */
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!isSupabaseConfigured) { setIsLoading(false); return; }
      const { data: authData } = await supabase.auth.getUser();
      if (!active || !authData.user) { setIsLoading(false); return; }
      const uid = authData.user.id;
      setUserId(uid);

      const { data, error } = await supabase
        .from("savings_vaults")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) { console.error("[Vault] load error", error); }
      else {
        // Auto-unlock matured vaults
        const now = new Date();
        const autoUnlocked: VaultItem[] = (data ?? []).map((v) =>
          v.status === "locked" && new Date(v.unlock_date) <= now
            ? { ...v, status: "unlocked" as const }
            : v
        );
        // Persist any auto-unlocks
        for (const v of autoUnlocked) {
          if (v.status === "unlocked" && (data ?? []).find((d) => d.id === v.id)?.status === "locked") {
            await supabase.from("savings_vaults").update({ status: "unlocked" }).eq("id", v.id);
          }
        }
        setVaults(autoUnlocked);
      }
      setIsLoading(false);
    };
    load();
    return () => { active = false; };
  }, []);

  const totalLocked = vaults.filter((v) => v.status === "locked").reduce((s, v) => s + v.amount, 0);
  const totalProjected = vaults.filter((v) => v.status === "locked").reduce(
    (s, v) => s + computeProjectedGrowth(v.amount, v.interest_rate, v.lock_days), 0
  );

  const todayISO = useMemo(() => new Date().toISOString().split("T")[0], []);
  const customLockDays = useMemo(() => {
    if (!customUnlockDate) return null;
    const now = new Date();
    const target = new Date(`${customUnlockDate}T00:00:00`);
    if (target <= now) return null;
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, [customUnlockDate]);
  const effectiveRate = useMemo(() => {
    const manual = Number(customApy);
    if (!Number.isNaN(manual) && manual > 0) return manual / 100;
    if (customLockDays != null) {
      const nearest = LOCK_OPTIONS.reduce(
        (best, o) => (Math.abs(o.days - customLockDays) < Math.abs(best.days - customLockDays) ? o : best),
        LOCK_OPTIONS[0]
      );
      return nearest.rate;
    }
    return LOCK_OPTIONS[newLockIdx].rate;
  }, [customApy, customLockDays, newLockIdx]);
  const customProjected = useMemo(() => {
    if (!newAmount || !effectiveRate) return null;
    const days = customLockDays ?? LOCK_OPTIONS[newLockIdx].days;
    return computeProjectedGrowth(newAmount, effectiveRate, days);
  }, [newAmount, effectiveRate, customLockDays, newLockIdx]);

  const handleCreate = async () => {
    if (!newName.trim()) { toast({ title: "Enter a vault name", variant: "destructive" }); return; }
    if (newAmount <= 0) { toast({ title: "Enter an amount greater than 0", variant: "destructive" }); return; }
    if (!userId) { toast({ title: "Sign in to create vaults", variant: "destructive" }); return; }
    if (useCustom && !customUnlockDate) { toast({ title: "Pick an unlock date for custom period", variant: "destructive" }); return; }
    if (useCustom && customUnlockDate && (customLockDays == null || customLockDays < 1)) { toast({ title: "Unlock date must be in the future", variant: "destructive" }); return; }
    const manualApy = Number(customApy);
    if (useCustom && customApy.trim() && (Number.isNaN(manualApy) || manualApy <= 0 || manualApy > 100)) { toast({ title: "Enter a valid APY (e.g. 1–50)", variant: "destructive" }); return; }

    let lockDays: number;
    let unlockDate: Date;
    const now = new Date();

    if (useCustom && customUnlockDate) {
      const target = new Date(`${customUnlockDate}T00:00:00`);
      if (target <= now) {
        toast({ title: "Unlock date must be in the future", variant: "destructive" });
        return;
      }
      lockDays = customLockDays ?? 0;
      unlockDate = target;
    } else {
      const option = LOCK_OPTIONS[newLockIdx];
      lockDays = option.days;
      unlockDate = new Date(now);
      unlockDate.setDate(unlockDate.getDate() + option.days);
    }

    const vault: VaultItem = {
      id: generateId(),
      name: newName,
      amount: newAmount,
      lock_days: lockDays,
      created_at: now.toISOString(),
      unlock_date: unlockDate.toISOString(),
      status: "locked",
      interest_rate: effectiveRate,
    };

    setIsSaving(true);
    const { error } = await supabase.from("savings_vaults").insert({
      ...vault,
      user_id: userId,
    });
    setIsSaving(false);

    if (error) {
      toast({ title: "Failed to create vault", description: error.message, variant: "destructive" });
      return;
    }

    setVaults([vault, ...vaults]);
    setShowCreate(false);
    setNewName(""); setNewAmount(0); setNewLockIdx(0);
    setUseCustom(false); setCustomUnlockDate(""); setCustomApy("");
    toast({ title: "Vault created!", description: `Locked for ${vault.lock_days} days at ${Math.round(vault.interest_rate * 100)}% APY` });
  };

  const confirmBreakVault = async () => {
    if (breakText !== "UNLOCK") { toast({ title: "Type UNLOCK to confirm", variant: "destructive" }); return; }
    const { error } = await supabase.from("savings_vaults").update({ status: "broken" }).eq("id", confirmBreak);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setVaults(vaults.map((v) => v.id === confirmBreak ? { ...v, status: "broken" } : v));
    setConfirmBreak(null); setBreakText("");
    toast({ title: "Vault broken", description: "Funds released but no interest earned." });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("savings_vaults").delete().eq("id", id);
    if (error) { toast({ title: "Error deleting vault", variant: "destructive" }); return; }
    setVaults(vaults.filter((v) => v.id !== id));
    toast({ title: "Vault deleted" });
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 space-y-4 sm:space-y-6">
        <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-warm flex items-center justify-center shadow-glow-warning">
                <Vault className="w-6 h-6 text-accent-foreground" />
              </div>
              Savings Vault
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Lock away savings with simulated interest growth</p>
          </div>
          <Button className="bg-gradient-primary hover:opacity-90" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-4 h-4 mr-2" /> New Vault
          </Button>
        </motion.header>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Locked</p>
            <p className="font-mono text-2xl font-bold text-primary">{formatCurrency(totalLocked)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Projected Value</p>
            <p className="font-mono text-2xl font-bold text-success">{formatCurrency(totalProjected)}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Active Vaults</p>
            <p className="font-mono text-2xl font-bold text-foreground">{vaults.filter((v) => v.status === "locked").length}</p>
          </motion.div>
        </div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="glass-card rounded-2xl p-6 border border-border space-y-5 overflow-hidden">
              <h2 className="font-display text-lg font-semibold text-foreground">Create Savings Vault</h2>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Vault Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Emergency Fund, Vacation" className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1 block">Amount (UGX)</label>
                <input type="number" value={newAmount || ""} onChange={(e) => setNewAmount(Number(e.target.value) || 0)} placeholder="Enter amount" className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Lock Period</label>
                <div className="grid grid-cols-4 gap-3">
                  {LOCK_OPTIONS.map((option, idx) => {
                    const projected = newAmount > 0 ? computeProjectedGrowth(newAmount, option.rate, option.days) : 0;
                    const sel = !useCustom && newLockIdx === idx;
                    return (
                      <button key={option.days} type="button" onClick={() => { setUseCustom(false); setNewLockIdx(idx); setCustomUnlockDate(""); setCustomApy(""); }} className={cn("p-3 rounded-xl border text-center transition-all", sel ? "border-primary/50 bg-primary/10 shadow-glow-sm" : "border-border bg-muted/20 hover:border-primary/30")}>
                        <p className="font-semibold text-sm text-foreground">{option.label}</p>
                        <p className="text-xs text-primary font-mono">{Math.round(option.rate * 100)}% APY</p>
                        {newAmount > 0 && <p className="text-[10px] text-success mt-1"><Sparkles className="w-2.5 h-2.5 inline" /> {formatCurrency(projected)}</p>}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => { setUseCustom(true); setCustomUnlockDate(""); setCustomApy(""); }}
                    className={cn("p-3 rounded-xl border text-center transition-all", useCustom ? "border-primary/50 bg-primary/10 shadow-glow-sm" : "border-border bg-muted/20 hover:border-primary/30")}
                  >
                    <p className="font-semibold text-sm text-foreground">Custom</p>
                    <p className="text-xs text-muted-foreground">Date & APY</p>
                    {newAmount > 0 && customProjected != null && <p className="text-[10px] text-success mt-1"><Sparkles className="w-2.5 h-2.5 inline" /> {formatCurrency(customProjected)}</p>}
                  </button>
                </div>
                {useCustom && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Unlock Date</label>
                      <input type="date" min={todayISO} value={customUnlockDate} onChange={(e) => setCustomUnlockDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-muted/30 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" placeholder="Pick date" />
                      {customLockDays != null && <p className="text-[10px] text-primary mt-1">{customLockDays} days</p>}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Custom APY (%)</label>
                      <input type="number" min={0.1} max={100} step={0.1} placeholder="e.g. 8" value={customApy} onChange={(e) => setCustomApy(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-muted/30 border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
                      {effectiveRate > 0 && <p className="text-[10px] text-primary mt-1">{(effectiveRate * 100).toFixed(1)}% APY</p>}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 bg-gradient-primary hover:opacity-90" onClick={handleCreate} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
                  Lock Funds
                </Button>
                <Button variant="outline" onClick={() => { setShowCreate(false); setUseCustom(false); setCustomUnlockDate(""); setCustomApy(""); }}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Break Confirmation Dialog */}
        <AnimatePresence>
          {confirmBreak && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-card rounded-2xl p-6 border border-destructive/30 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="w-5 h-5 text-destructive" /></div>
                <div>
                  <h3 className="font-semibold text-foreground">Break this vault?</h3>
                  <p className="text-sm text-muted-foreground">You'll lose all simulated interest. Type <strong>UNLOCK</strong> to confirm.</p>
                </div>
              </div>
              <input value={breakText} onChange={(e) => setBreakText(e.target.value)} placeholder='Type "UNLOCK" to confirm' className="w-full px-3 py-2 bg-muted/30 rounded-lg text-foreground text-sm border border-destructive/30 focus:outline-none focus:ring-2 focus:ring-destructive/50 font-mono" />
              <div className="flex gap-2">
                <Button variant="destructive" className="flex-1" onClick={confirmBreakVault}>Confirm Break</Button>
                <Button variant="outline" onClick={() => { setConfirmBreak(null); setBreakText(""); }}>Cancel</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Vaults Grid */}
        {isLoading ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-primary animate-spin mb-2" />
            <p className="text-muted-foreground text-sm">Loading your vaults…</p>
          </div>
        ) : vaults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {vaults.map((vault) => (
              <VaultCard key={vault.id} item={vault} onBreak={() => { setConfirmBreak(vault.id); setBreakText(""); }} onDelete={() => handleDelete(vault.id)} />
            ))}
          </div>
        ) : (
          !showCreate && (
            <div className="glass-card rounded-xl p-8 text-center space-y-2">
              <Vault className="w-12 h-12 mx-auto text-muted-foreground/50" />
              <p className="text-foreground font-medium">No vaults yet</p>
              <p className="text-muted-foreground text-sm">Create a vault to lock away savings and watch them grow with simulated interest.</p>
            </div>
          )
        )}
      </div>
    </AppLayout>
  );
}
