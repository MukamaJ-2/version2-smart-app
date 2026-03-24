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

interface ReallocateBudgetPortModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourcePort: BudgetPot | null;
  allPorts: BudgetPot[];
  onReallocate: (fromId: string, toId: string, amount: number) => void;
}

export default function ReallocateBudgetPortModal({
  open,
  onOpenChange,
  sourcePort,
  allPorts,
  onReallocate,
}: ReallocateBudgetPortModalProps) {
  const [targetPortId, setTargetPortId] = useState("");
  const [amount, setAmount] = useState("");

  const available = sourcePort ? sourcePort.allocated - sourcePort.spent : 0;
  const targetPorts = allPorts.filter((p) => p.id !== sourcePort?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourcePort || !targetPortId) return;
    const numAmount = parseFloat(amount) || 0;
    if (numAmount <= 0 || numAmount > available) return;
    onReallocate(sourcePort.id, targetPortId, numAmount);
    setTargetPortId("");
    setAmount("");
    onOpenChange(false);
  };

  if (!sourcePort) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border">
        <DialogHeader>
          <DialogTitle>Move money from {sourcePort.name}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Available: {formatCurrency(available)}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="target-port">Move to port</Label>
            <select
              id="target-port"
              value={targetPortId}
              onChange={(e) => setTargetPortId(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="">Choose a budget…</option>
              {targetPorts.map((p) => (
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
              Move money
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
