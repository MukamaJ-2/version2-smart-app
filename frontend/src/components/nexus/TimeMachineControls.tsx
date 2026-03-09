import { useState, useEffect } from "react";
import { Clock, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { format, addMonths } from "date-fns";

interface TimeMachineControlsProps {
    simulatedMonthsIntoFuture: number;
    onMonthsChange: (months: number) => void;
}

export function TimeMachineControls({
    simulatedMonthsIntoFuture,
    onMonthsChange,
}: TimeMachineControlsProps) {
    const [localMonths, setLocalMonths] = useState(simulatedMonthsIntoFuture);

    // Sync local state if prop changes externally
    useEffect(() => {
        setLocalMonths(simulatedMonthsIntoFuture);
    }, [simulatedMonthsIntoFuture]);

    const projectedDate = addMonths(new Date(), localMonths);
    const formattedDate = format(projectedDate, "MMMM yyyy");

    return (
        <div className="glass-card rounded-2xl p-4 mt-6 border border-primary/20 bg-background/50 backdrop-blur-md relative overflow-hidden group">
            {/* Background glow when active */}
            <div
                className="absolute inset-0 bg-primary/5 transition-opacity duration-700 pointer-events-none"
                style={{ opacity: localMonths > 0 ? 0.5 + (localMonths / 60) * 0.5 : 0 }}
            />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-xl bg-primary/20 text-primary">
                            <Clock className="w-5 h-5 animate-pulse" style={{ animationDuration: '3s' }} />
                        </div>
                        <div>
                            <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2">
                                Time Machine
                                {localMonths > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary animate-in fade-in zoom-in">Active</span>}
                            </h3>
                            <p className="text-muted-foreground text-xs">Project financial state into the future</p>
                        </div>
                    </div>

                    <div className="text-right">
                        <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest">Projected Date</p>
                        <p className="font-display text-lg font-bold text-primary text-glow-sm">
                            {localMonths === 0 ? "Present Data" : formattedDate}
                        </p>
                    </div>
                </div>

                <div className="px-2">
                    <Slider
                        defaultValue={[0]}
                        max={60}
                        step={1}
                        value={[localMonths]}
                        onValueChange={(vals) => setLocalMonths(vals[0])}
                        onValueCommit={(vals) => onMonthsChange(vals[0])}
                        className="my-6"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground font-mono">
                        <span>Now</span>
                        <span>+1 Yr</span>
                        <span>+2 Yrs</span>
                        <span>+3 Yrs</span>
                        <span>+4 Yrs</span>
                        <span>+5 Yrs</span>
                    </div>
                </div>

                {localMonths > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50 flex items-start gap-2 text-xs text-muted-foreground animate-in slide-in-from-top-2 opacity-80">
                        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <p>
                            Simulating <strong className="text-foreground">+{localMonths} months</strong> into the future based on AI forecasting of your current spending run-rate and goal contributions.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
