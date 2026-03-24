import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Receipt, Loader2, Sparkles, CheckCircle2, ImagePlus, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiService } from "@/lib/ai/ai-service";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type ParsedReceipt = {
    extractedText: string[];
    rawText: string;
    suggestedAmount: number;
    structured?: Record<string, string | number>;
};

function normalizeReceiptResult(data: unknown): ParsedReceipt {
    const d = data as Record<string, unknown>;
    if (d.extractedText && Array.isArray(d.extractedText)) {
        return {
            extractedText: d.extractedText as string[],
            rawText: (d.rawText as string) ?? (d.extractedText as string[]).join("\n"),
            suggestedAmount: Number(d.suggestedAmount) || 0,
            structured: (d.structured as Record<string, string | number>) ?? undefined,
        };
    }
    const items = (d.items as Array<{ description?: string; amount?: number }>) ?? [];
    const lines = items.map((i) => i.description ?? "").filter(Boolean);
    const total = Number(d.totalAmount) ?? items.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const merchant = String(d.merchant ?? "");
    return {
        extractedText: merchant ? [merchant, ...lines] : lines,
        rawText: [merchant, ...lines].filter(Boolean).join("\n"),
        suggestedAmount: total,
    };
}

const STRUCTURED_LABELS: Record<string, string> = {
    merchant: "Merchant / Bank",
    amount: "Amount",
    date: "Date",
    time: "Time",
    receiptNumber: "Receipt No",
    transactionType: "Transaction Type",
    outlet: "Outlet",
    name: "Name",
    cardMasked: "Card",
    charge: "Charge",
    balance: "Balance",
};

interface BatchEntry {
    file: File;
    previewUrl: string;
    status: "pending" | "parsing" | "done" | "error";
    result: ParsedReceipt | null;
    errorMessage?: string;
}

interface ReceiptScannerProps {
    onConfirmSplit: (parsed: ParsedReceipt) => void;
    onClose: () => void;
}

export function ReceiptScanner({ onConfirmSplit, onClose }: ReceiptScannerProps) {
    const [batch, setBatch] = useState<BatchEntry[]>([]);
    const [activeIndex, setActiveIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    const handleFilesSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files;
        if (!selected || selected.length === 0) return;

        const entries: BatchEntry[] = Array.from(selected).map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file),
            status: "pending" as const,
            result: null,
        }));

        setBatch(entries);
        setActiveIndex(0);

        // Start batch processing
        setIsProcessing(true);
        for (let i = 0; i < entries.length; i++) {
            setBatch((prev) => prev.map((e, idx) => idx === i ? { ...e, status: "parsing" } : e));
            setActiveIndex(i);

            try {
                const raw = await aiService.parseReceipt(entries[i].file);
                const result = normalizeReceiptResult(raw);
                setBatch((prev) => prev.map((e, idx) => idx === i ? { ...e, status: "done", result } : e));
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Failed to parse receipt";
                setBatch((prev) => prev.map((e, idx) => idx === i ? { ...e, status: "error", errorMessage: msg } : e));
            }
        }
        setIsProcessing(false);
    }, []);

    const active = batch[activeIndex];
    const doneCount = batch.filter((b) => b.status === "done").length;
    const totalCount = batch.length;

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("en-UG", { style: "currency", currency: "UGX", maximumFractionDigits: 0 }).format(val);
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
                className="w-full max-w-lg glass-card-glow rounded-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Receipt className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-display text-lg font-semibold text-foreground">Scan Receipts</h2>
                            {totalCount > 1 && (
                                <p className="text-xs text-muted-foreground">
                                    {doneCount}/{totalCount} processed • Batch Mode
                                </p>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6">
                    {/* Upload area */}
                    {batch.length === 0 && (
                        <div className="border-2 border-dashed border-border/50 rounded-xl p-12 flex flex-col items-center justify-center text-center transition-colors hover:bg-muted/10 relative">
                            <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFilesSelected}
                            />
                            <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
                            <p className="text-sm font-medium text-foreground mb-1">Click or drag receipts here</p>
                            <div className="flex items-center gap-2 mt-2">
                                <ImagePlus className="w-4 h-4 text-primary" />
                                <p className="text-xs text-primary font-medium">Select multiple for batch scanning</p>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Supported formats: JPG, PNG</p>
                        </div>
                    )}

                    {/* Batch thumbnail strip */}
                    {totalCount > 1 && (
                        <div className="flex items-center gap-2 overflow-x-auto pb-2">
                            {batch.map((entry, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setActiveIndex(idx)}
                                    className={cn(
                                        "shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden relative transition-all",
                                        idx === activeIndex ? "border-primary ring-2 ring-primary/30" : "border-border/30",
                                        entry.status === "error" && "border-destructive/50"
                                    )}
                                >
                                    <img src={entry.previewUrl} alt="" className="w-full h-full object-cover" />
                                    {entry.status === "done" && (
                                        <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-success" />
                                        </div>
                                    )}
                                    {entry.status === "parsing" && (
                                        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                        </div>
                                    )}
                                    {entry.status === "error" && (
                                        <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                                            <X className="w-4 h-4 text-destructive" />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Active receipt: parsing state */}
                    {active?.status === "parsing" && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                                <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
                            </div>
                            <p className="text-sm text-foreground font-medium animate-pulse">
                                Running AI Vision Extraction... ({activeIndex + 1}/{totalCount})
                            </p>
                            <p className="text-xs text-muted-foreground">Identifying merchants, line items, and prices</p>
                        </div>
                    )}

                    {/* Active receipt: result */}
                    {active?.status === "done" && active.result && (
                        <motion.div
                            key={activeIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <h4 className="text-sm font-semibold text-foreground px-1 flex items-center gap-1">
                                <Sparkles className="w-3.5 h-3.5 text-primary" />
                                Receipt details
                            </h4>

                            {active.result.structured && Object.keys(active.result.structured).length > 0 && (
                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                                    {Object.entries(active.result.structured).map(([key, val]) => (
                                        <div key={key} className="flex justify-between gap-3 text-sm">
                                            <span className="text-muted-foreground shrink-0">
                                                {STRUCTURED_LABELS[key] ?? key}:
                                            </span>
                                            <span className="text-foreground font-medium text-right break-all">
                                                {typeof val === "number" && (key === "amount" || key === "charge" || key === "balance")
                                                    ? formatCurrency(val)
                                                    : String(val)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground px-1">
                                    Raw extracted text (used for category prediction)
                                </p>
                                <div className="bg-background/50 rounded-xl border border-border/50 divide-y divide-border/50 max-h-40 overflow-y-auto">
                                    {(active.result.extractedText ?? []).length > 0 ? (
                                        (active.result.extractedText ?? []).slice(0, 15).map((line, idx) => (
                                            <div key={idx} className="px-3 py-2">
                                                <p className="text-xs text-foreground whitespace-pre-wrap">{line}</p>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="p-4 text-sm text-muted-foreground">No text detected</p>
                                    )}
                                    {(active.result.extractedText ?? []).length > 15 && (
                                        <p className="px-3 py-2 text-xs text-muted-foreground">
                                            … and {(active.result.extractedText ?? []).length - 15} more lines
                                        </p>
                                    )}
                                </div>
                                {(active.result.suggestedAmount ?? 0) > 0 && (
                                    <p className="text-xs text-muted-foreground px-1">
                                        Suggested amount: {formatCurrency(active.result.suggestedAmount ?? 0)}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Active receipt: error */}
                    {active?.status === "error" && (
                        <div className="text-center py-8">
                            <X className="w-10 h-10 text-destructive mx-auto mb-2" />
                            <p className="text-sm text-foreground">Failed to parse this receipt</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                                {active.errorMessage ?? "Try a clearer image or ensure the backend is running."}
                            </p>
                        </div>
                    )}
                </div>

                {/* Navigation + Actions footer */}
                <div className="flex gap-3 pt-4 border-t border-border/50 mt-auto flex-shrink-0 bg-background/50">
                    {totalCount > 1 && (
                        <div className="flex items-center gap-1 mr-auto">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={activeIndex === 0}
                                onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="text-xs font-mono text-muted-foreground">
                                {activeIndex + 1}/{totalCount}
                            </span>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={activeIndex >= totalCount - 1}
                                onClick={() => setActiveIndex((i) => Math.min(totalCount - 1, i + 1))}
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    )}

                    <Button
                        variant="outline"
                        className="flex-1 border-border hover:border-primary/50"
                        onClick={() => {
                            if (batch.length > 0) {
                                batch.forEach((b) => URL.revokeObjectURL(b.previewUrl));
                                setBatch([]);
                                setActiveIndex(0);
                            } else {
                                onClose();
                            }
                        }}
                    >
                        {batch.length > 0 ? "Scan More" : "Cancel"}
                    </Button>

                    <Button
                        className="flex-1 bg-gradient-primary hover:opacity-90 relative overflow-hidden group"
                        disabled={!active?.result || isProcessing}
                        onClick={() => {
                            if (active?.result) onConfirmSplit(active.result);
                        }}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm & Split
                        </span>
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}
