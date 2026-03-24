import { useState, useEffect, useMemo } from "react";
import { Clock, Info, Rewind, FastForward, Flag, Calendar, TrendingUp, TrendingDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { format, addMonths, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/* ───────── Milestone Markers ───────── */

interface Milestone {
    label: string;
    monthOffset: number; // negative = past, positive = future
    type: "achievement" | "goal" | "event";
    icon: "flag" | "target" | "calendar";
}

function generateMilestones(
    goals: { name: string; deadline: string; targetAmount: number; currentAmount: number }[],
    pastMonths: number
): Milestone[] {
    const milestones: Milestone[] = [];
    const now = new Date();

    // Future milestones from goals
    for (const goal of goals) {
        const deadline = new Date(goal.deadline);
        const monthsAway = Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
        if (monthsAway > 0 && monthsAway <= 60) {
            milestones.push({
                label: `${goal.name} deadline`,
                monthOffset: monthsAway,
                type: "goal",
                icon: "target",
            });
        }
    }

    // Past milestones (quarterly markers)
    for (let m = -3; m >= -pastMonths; m -= 3) {
        const pastDate = subMonths(now, Math.abs(m));
        milestones.push({
            label: format(pastDate, "MMM yyyy"),
            monthOffset: m,
            type: "event",
            icon: "calendar",
        });
    }

    // Future milestones (yearly markers)
    for (let y = 12; y <= 60; y += 12) {
        milestones.push({
            label: `+${y / 12} year${y > 12 ? "s" : ""}`,
            monthOffset: y,
            type: "event",
            icon: "calendar",
        });
    }

    return milestones;
}

/* ───────── Component ───────── */

interface TimeMachineControlsProps {
    simulatedMonthsIntoFuture: number;
    onMonthsChange: (months: number) => void;
    goals?: { name: string; deadline: string; targetAmount: number; currentAmount: number }[];
}

export function TimeMachineControls({
    simulatedMonthsIntoFuture,
    onMonthsChange,
    goals = [],
}: TimeMachineControlsProps) {
    const [localMonths, setLocalMonths] = useState(simulatedMonthsIntoFuture);
    const [mode, setMode] = useState<"future" | "past">("future");

    const PAST_LIMIT = 12; // up to 12 months back
    const FUTURE_LIMIT = 60;

    useEffect(() => {
        setLocalMonths(simulatedMonthsIntoFuture);
    }, [simulatedMonthsIntoFuture]);

    const sliderValue = mode === "past"
        ? PAST_LIMIT + localMonths // negative months → 0..PAST_LIMIT range
        : PAST_LIMIT + localMonths;

    const projectedDate = localMonths >= 0
        ? addMonths(new Date(), localMonths)
        : subMonths(new Date(), Math.abs(localMonths));
    const formattedDate = format(projectedDate, "MMMM yyyy");

    const milestones = useMemo(() => generateMilestones(goals, PAST_LIMIT), [goals]);

    const handleSliderChange = (vals: number[]) => {
        const raw = vals[0] - PAST_LIMIT; // convert to signed offset
        setLocalMonths(raw);
    };

    const handleSliderCommit = (vals: number[]) => {
        const raw = vals[0] - PAST_LIMIT;
        onMonthsChange(raw);
    };

    // Compute milestone positions on the slider (0..PAST_LIMIT+FUTURE_LIMIT)
    const sliderMax = PAST_LIMIT + FUTURE_LIMIT;

    return (
        <div className="glass-card rounded-2xl p-3 sm:p-4 mt-4 sm:mt-6 border border-primary/20 bg-background/50 backdrop-blur-md relative overflow-hidden group min-w-0">
            {/* Background glow */}
            <div
                className="absolute inset-0 transition-opacity duration-700 pointer-events-none"
                style={{
                    opacity: localMonths !== 0 ? 0.3 + (Math.abs(localMonths) / 60) * 0.4 : 0,
                    background: localMonths < 0
                        ? "linear-gradient(135deg, rgba(168,85,247,0.1), transparent)"
                        : "linear-gradient(135deg, rgba(0,212,255,0.1), transparent)",
                }}
            />

            <div className="relative z-10 min-w-0">
                {/* Header: stack on mobile, row on larger screens */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                            "p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0",
                            localMonths < 0 ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
                        )}>
                            {localMonths < 0 ? (
                                <Rewind className="w-4 h-4 sm:w-5 sm:h-5" style={{ animationDuration: '3s' }} />
                            ) : (
                                <Clock className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" style={{ animationDuration: '3s' }} />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-display font-semibold text-foreground text-sm flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <span>Look back or ahead</span>
                                {localMonths !== 0 && (
                                    <span className={cn(
                                        "text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full animate-in fade-in zoom-in shrink-0",
                                        localMonths < 0 ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
                                    )}>
                                        {localMonths < 0 ? "Past" : "Future"}
                                    </span>
                                )}
                            </h3>
                            <p className="text-muted-foreground text-[11px] sm:text-xs truncate sm:whitespace-normal">
                                {localMonths < 0 ? "See how your numbers looked in earlier months" : "See a simple guess at future months"}
                            </p>
                        </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                        <p className="font-mono text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wider sm:tracking-widest">
                            {localMonths < 0 ? "Month you’re viewing" : "Month you’re previewing"}
                        </p>
                        <p className={cn(
                            "font-display text-base sm:text-lg font-bold text-glow-sm truncate",
                            localMonths < 0 ? "text-secondary" : "text-primary"
                        )}>
                            {localMonths === 0 ? "This month" : formattedDate}
                        </p>
                    </div>
                </div>

                {/* Mode Toggle - full width on mobile for better touch targets */}
                <div className="flex items-stretch sm:items-center gap-1 sm:gap-1 mb-2 sm:mb-3">
                    <Button
                        variant={localMonths < 0 ? "default" : "outline"}
                        size="sm"
                        className={cn("flex-1 sm:flex-initial text-xs h-9 sm:h-7 min-h-[44px] sm:min-h-0 touch-manipulation", localMonths < 0 && "bg-secondary hover:bg-secondary/90")}
                        onClick={() => {
                            setLocalMonths(-3);
                            onMonthsChange(-3);
                        }}
                    >
                        <Rewind className="w-3 h-3 mr-1 shrink-0" /> Past
                    </Button>
                    <Button
                        variant={localMonths === 0 ? "default" : "outline"}
                        size="sm"
                        className="flex-1 sm:flex-initial text-xs h-9 sm:h-7 min-h-[44px] sm:min-h-0 touch-manipulation"
                        onClick={() => {
                            setLocalMonths(0);
                            onMonthsChange(0);
                        }}
                    >
                        Now
                    </Button>
                    <Button
                        variant={localMonths > 0 ? "default" : "outline"}
                        size="sm"
                        className={cn("flex-1 sm:flex-initial text-xs h-9 sm:h-7 min-h-[44px] sm:min-h-0 touch-manipulation", localMonths > 0 && "bg-primary hover:bg-primary/90")}
                        onClick={() => {
                            setLocalMonths(6);
                            onMonthsChange(6);
                        }}
                    >
                        <FastForward className="w-3 h-3 mr-1 shrink-0" /> Future
                    </Button>
                </div>

                {/* Slider */}
                <div className="px-1 sm:px-2 relative min-w-0">
                    <Slider
                        defaultValue={[PAST_LIMIT]}
                        max={sliderMax}
                        step={1}
                        value={[sliderValue]}
                        onValueChange={handleSliderChange}
                        onValueCommit={handleSliderCommit}
                        className="my-4 sm:my-6"
                    />

                    {/* Milestone markers */}
                    <div className="absolute top-0 left-0 right-0 h-6 pointer-events-none">
                        {milestones.map((ms, i) => {
                            const pos = ((ms.monthOffset + PAST_LIMIT) / sliderMax) * 100;
                            if (pos < 0 || pos > 100) return null;
                            return (
                                <div
                                    key={i}
                                    className="absolute top-0 transform -translate-x-1/2"
                                    style={{ left: `${pos}%` }}
                                    title={ms.label}
                                >
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full",
                                        ms.type === "goal" ? "bg-warning" : "bg-muted-foreground/40"
                                    )} />
                                </div>
                            );
                        })}
                        {/* Now marker */}
                        <div
                            className="absolute top-0 transform -translate-x-1/2"
                            style={{ left: `${(PAST_LIMIT / sliderMax) * 100}%` }}
                        >
                            <div className="w-2 h-2 rounded-full bg-primary ring-2 ring-primary/30" />
                        </div>
                    </div>

                    <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground font-mono gap-1">
                        <span className="truncate">-1Y</span>
                        <span className="text-primary font-bold shrink-0">Now</span>
                        <span className="truncate">+1Y</span>
                        <span className="hidden sm:inline truncate">+3Y</span>
                        <span className="truncate">+5Y</span>
                    </div>
                </div>

                {/* Info + Milestones */}
                {localMonths !== 0 && (
                    <div className="mt-3 sm:mt-4 pt-3 border-t border-border/50 animate-in slide-in-from-top-2">
                        <div className="flex items-start gap-2 text-[11px] sm:text-xs text-muted-foreground opacity-80">
                            <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 mt-0.5" style={{ color: localMonths < 0 ? "hsl(var(--secondary))" : "hsl(var(--primary))" }} />
                            {localMonths < 0 ? (
                                <p className="min-w-0">Showing your data from <strong className="text-foreground">{Math.abs(localMonths)} months ago</strong>. The map and totals above follow this view.</p>
                            ) : (
                                <p className="min-w-0">Showing a rough picture <strong className="text-foreground">{localMonths} months ahead</strong> using your usual spending and goal payments—not a promise, just a guide.</p>
                            )}
                        </div>

                        {/* Nearby milestones */}
                        {milestones.filter((m) => Math.abs(m.monthOffset - localMonths) <= 3).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                                {milestones
                                    .filter((m) => Math.abs(m.monthOffset - localMonths) <= 3)
                                    .map((m, i) => (
                                        <span key={i} className={cn(
                                            "text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full border",
                                            m.type === "goal" ? "bg-warning/10 border-warning/20 text-warning" : "bg-muted/20 border-border text-muted-foreground"
                                        )}>
                                            <Flag className="w-2.5 h-2.5 inline mr-0.5" />
                                            {m.label}
                                        </span>
                                    ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
