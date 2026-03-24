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
import type { BudgetPot } from "@/hooks/useFinancialData";

interface AddBudgetPortModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (pot: Omit<BudgetPot, "id">) => void;
}

export default function AddBudgetPortModal({ open, onOpenChange, onAdd }: AddBudgetPortModalProps) {
  const [name, setName] = useState("");
  const [allocated, setAllocated] = useState("");
  const [category, setCategory] = useState<BudgetPot["category"]>("wants");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(allocated) || 0;
    if (!name.trim() || amount <= 0) return;
    onAdd({
      name: name.trim(),
      allocated: amount,
      spent: 0,
      status: "healthy",
      velocity: 30,
      category,
    });
    setName("");
    setAllocated("");
    setCategory("wants");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border">
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="port-name">Name</Label>
            <Input
              id="port-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="port-allocated">Amount for this budget (UGX)</Label>
            <Input
              id="port-allocated"
              type="number"
              min="1"
              value={allocated}
              onChange={(e) => setAllocated(e.target.value)}
              placeholder="0"
              className="mt-1"
              required
            />
          </div>
          <div>
            <Label htmlFor="port-category">Category</Label>
            <select
              id="port-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as BudgetPot["category"])}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="needs">Needs (50%)</option>
              <option value="wants">Wants (30%)</option>
              <option value="savings">Savings (20%)</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-gradient-primary hover:opacity-90">
              Add budget
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
