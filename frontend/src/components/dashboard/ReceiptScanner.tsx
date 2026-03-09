import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, Receipt, Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aiService } from "@/lib/ai/ai-service";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type ParsedReceipt = {
    merchant: string;
    totalAmount: number;
    date: string;
    items: Array<{ description: string; amount: number; category: string }>;
};

interface ReceiptScannerProps {
    onConfirmSplit: (parsed: ParsedReceipt) => void;
    onClose: () => void;
}

export function ReceiptScanner({ onConfirmSplit, onClose }: ReceiptScannerProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [parsedResult, setParsedResult] = useState<ParsedReceipt | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        setFile(selected);
        const url = URL.createObjectURL(selected);
        setPreviewUrl(url);

        // Auto trigger parsing
        handleScan(selected);
    };

    const handleScan = async (fileToScan: File) => {
        setIsParsing(true);
        setParsedResult(null);
        try {
            const result = await aiService.parseReceipt(fileToScan);
            setParsedResult(result);
        } catch (error) {
            toast({
                title: "Scanning Failed",
                description: "We couldn't read this receipt. Please try another.",
                variant: "destructive"
            });
        } finally {
            setIsParsing(false);
        }
    };

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
                        <h2 className="font-display text-lg font-semibold text-foreground">Scan Receipt</h2>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 pb-4 space-y-6">
                    {!file && !isParsing && !parsedResult && (
                        <div className="border-2 border-dashed border-border/50 rounded-xl p-12 flex flex-col items-center justify-center text-center transition-colors hover:bg-muted/10">
                            <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={handleFileChange}
                            />
                            <UploadCloud className="w-12 h-12 text-muted-foreground mb-4" />
                            <p className="text-sm font-medium text-foreground mb-1">Click or drag a receipt here</p>
                            <p className="text-xs text-muted-foreground">Supported formats: JPG, PNG</p>
                        </div>
                    )}

                    {isParsing && (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="relative">
                                {/* Visual parsing effect */}
                                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                                <Loader2 className="w-12 h-12 text-primary animate-spin relative z-10" />
                            </div>
                            <p className="text-sm text-foreground font-medium animate-pulse">Running AI Vision Extraction...</p>
                            <p className="text-xs text-muted-foreground">Identifying merchants, line items, and prices</p>
                        </div>
                    )}

                    {parsedResult && !isParsing && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="flex justify-between items-center p-4 rounded-xl border border-primary/30 bg-primary/5">
                                <div>
                                    <p className="text-xs text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        AI Parsed Total
                                    </p>
                                    <h3 className="font-display text-lg font-bold text-foreground">{parsedResult.merchant}</h3>
                                    <p className="text-xs text-muted-foreground">{parsedResult.date}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-2xl font-bold text-destructive text-glow-sm">
                                        {formatCurrency(parsedResult.totalAmount)}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-foreground px-1">Itemized Extraction</h4>
                                <div className="bg-background/50 rounded-xl border border-border/50 divide-y divide-border/50">
                                    {parsedResult.items.map((item, idx) => (
                                        <motion.div
                                            key={idx}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.1 }}
                                            className="flex items-center justify-between p-3 flex-wrap gap-2"
                                        >
                                            <div className="flex-1 min-w-[120px]">
                                                <p className="text-sm text-foreground">{item.description}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs px-2 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20 whitespace-nowrap">
                                                    {item.category}
                                                </span>
                                                <span className="font-mono text-sm text-foreground w-16 text-right">
                                                    {formatCurrency(item.amount)}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex gap-3 pt-4 border-t border-border/50 mt-auto flex-shrink-0 bg-background/50">
                    <Button
                        variant="outline"
                        className="flex-1 border-border hover:border-primary/50"
                        onClick={() => {
                            if (parsedResult) {
                                setFile(null);
                                setPreviewUrl(null);
                                setParsedResult(null);
                            } else {
                                onClose();
                            }
                        }}
                    >
                        {parsedResult ? "Scan Another" : "Cancel"}
                    </Button>

                    <Button
                        className="flex-1 bg-gradient-primary hover:opacity-90 relative overflow-hidden group"
                        disabled={!parsedResult}
                        onClick={() => {
                            if (parsedResult) onConfirmSplit(parsedResult);
                        }}
                    >
                        <span className="relative z-10 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            Confirm & Split
                        </span>
                        {/* Hover gleam */}
                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:animate-shimmer" />
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}
