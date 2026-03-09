import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/hooks/useFinancialData";
import type { BudgetPot } from "@/hooks/useFinancialData";

interface ReallocateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourcePod: BudgetPot | null;
  allPods: BudgetPot[];
  onReallocate: (fromId: string, toId: string, amount: number) => void;
}

export default function ReallocateModal({
  open,
  onOpenChange,
  sourcePod,
  allPods,
  onReallocate,
}: ReallocateModalProps) {
  const [targetPodId, setTargetPodId] = useState("");
  const [amount, setAmount] = useState("");

  const available = sourcePod ? sourcePod.allocated - sourcePod.spent : 0;
  const targetPods = allPods.filter((p) => p.id !== sourcePod?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourcePod || !targetPodId) return;
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0 || numAmount > available) return;
    onReallocate(sourcePod.id, targetPodId, numAmount);
    setTargetPodId("");
    setAmount("");
    onOpenChange(false);
  };

  if (!sourcePod) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border">
        <DialogHeader>
          <DialogTitle>Reallocate from {sourcePod.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Available: {formatCurrency(available)}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="target-pod">Move to port</Label>
            <select
              id="target-pod"
              value={targetPodId}
              onChange={(e) => setTargetPodId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Select a port...</option>
              {targetPods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({formatCurrency(p.allocated - p.spent)} left)
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="reallocate-amount">Amount (UGX)</Label>
            <Input
              id="reallocate-amount"
              type="number"
              min="1"
              max={available}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Max ${formatCurrency(available)}`}
              className="mt-1"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-primary hover:opacity-90">
              Reallocate
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
