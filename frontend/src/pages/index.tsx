import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Activity, Moon, Sun, User, Pencil, Target } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import FinancialNexus from "@/components/nexus/FinancialNexus";
import { TimeMachineControls } from "@/components/nexus/TimeMachineControls";
import { TimeMachineInsights } from "@/components/nexus/TimeMachineInsights";
import AppLayout from "@/components/layout/AppLayout";
import QuickStats from "@/components/dashboard/QuickStats";
import { FinancialWellnessScore } from "@/components/dashboard/FinancialWellnessScore";
import BudgetPortPreview from "@/components/dashboard/BudgetPortPreview";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import { SmartPredictionsFeed } from "@/components/dashboard/SmartPredictionsFeed";
import NotificationsPanel from "@/components/dashboard/NotificationsPanel";
import AnomalySummaryCard from "@/components/dashboard/AnomalySummaryCard";
import SpendingAlertsCard from "@/components/dashboard/SpendingAlertsCard";
import BudgetOverAlertBanner from "@/components/dashboard/BudgetOverAlertBanner";
import FeatureConnectionsStrip from "@/components/dashboard/FeatureConnectionsStrip";
import { Button } from "@/components/ui/button";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { OnboardingAnswers } from "@/lib/onboarding";
import {
  getLifeStageLabel,
  getSavingsGoalLabel,
  getAlertPreferenceLabel,
  shouldUseProfileForAlerts,
  getGoalSuggestionsFromSurvey,
} from "@/lib/onboarding";

interface ProfileData {
  name: string | null;
  onboarding_answers: OnboardingAnswers | null;
}

export default function Index() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [simulatedMonths, setSimulatedMonths] = useState(0);

  useEffect(() => {
    let isActive = true;
    const loadProfile = async () => {
      if (!isSupabaseConfigured) return;
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive || userError || !userData.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("name, onboarding_answers")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (!isActive) return;
      setProfile({
        name: (data as { name?: string } | null)?.name ?? null,
        onboarding_answers: (data as { onboarding_answers?: OnboardingAnswers } | null)
          ?.onboarding_answers ?? null,
      });
    };
    loadProfile();
    return () => {
      isActive = false;
    };
  }, []);

  const answers = profile?.onboarding_answers;
  const lifeStageLabel = answers ? getLifeStageLabel(answers) : null;
  const savingsGoalLabel = answers ? getSavingsGoalLabel(answers) : null;
  const alertLabel = answers ? getAlertPreferenceLabel(answers) : null;
  const essentialCount = answers?.essentialCategories?.length ?? 0;
  const goalSuggestions = answers ? getGoalSuggestionsFromSurvey(answers) : [];

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 flex flex-col gap-4 sm:gap-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-foreground truncate">
              {profile?.name ? (
                <>Welcome back, {profile.name.split(/\s+/)[0]}</>
              ) : (
                "Home"
              )}
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 truncate">
              {lifeStageLabel
                ? `Everything about your money in one place · ${lifeStageLabel}`
                : "Everything about your money in one place"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9 border-border hover:border-primary/50 touch-manipulation"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-2 glass-card px-3 sm:px-4 py-2 rounded-md min-h-[44px] sm:min-h-0 border-border/80">
              <Activity className="w-4 h-4 text-success shrink-0" strokeWidth={2} />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground hidden sm:inline tracking-wide">
                Live
              </span>
            </div>
          </div>
        </motion.header>

        {/* Budget over-spending alert */}
        <BudgetOverAlertBanner />

        {/* Quick Stats */}
        <QuickStats simulatedMonths={simulatedMonths} />

        {/* One row: link core tools without duplicating the full sidebar */}
        <FeatureConnectionsStrip />

        {/* Your profile summary (from onboarding) */}
        {answers && (lifeStageLabel || savingsGoalLabel || alertLabel || essentialCount > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-sm font-bold text-foreground tracking-tight">
                    Based on your profile
                  </h2>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Personalized insights</p>
                </div>
              </div>
              <Link
                to="/onboarding?edit=1"
                className="text-xs text-primary hover:text-primary-glow flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                Adjust
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              {lifeStageLabel && (
                <div>
                  <p className="text-muted-foreground text-xs">Life stage</p>
                  <p className="font-medium text-foreground">{lifeStageLabel}</p>
                </div>
              )}
              {savingsGoalLabel && (
                <div>
                  <p className="text-muted-foreground text-xs">Savings focus</p>
                  <p className="font-medium text-foreground">{savingsGoalLabel}</p>
                </div>
              )}
              {essentialCount > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs">Essential categories</p>
                  <p className="font-medium text-foreground">
                    {essentialCount} {essentialCount !== 1 ? "categories" : "category"} you marked as essential
                  </p>
                </div>
              )}
              {alertLabel && (
                <div>
                  <p className="text-muted-foreground text-xs">Alerts</p>
                  <p className="font-medium text-foreground">{alertLabel}</p>
                </div>
              )}
            </div>
            {shouldUseProfileForAlerts(answers) && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                We'll use your profile so we don't worry about overspend on categories you said are essential.
              </p>
            )}
            {goalSuggestions.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  Goals from your survey
                </p>
                <div className="flex flex-wrap gap-2">
                  {goalSuggestions.map((s) => (
                    <Link
                      key={`${s.type}-${s.label}`}
                      to={`/goals?create=${encodeURIComponent(s.label)}`}
                      className="text-xs font-medium text-primary hover:text-primary-glow hover:underline"
                    >
                      {s.type === "savings" ? "Saving for: " : "Planned: "}{s.label} →
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}


        {/* Money map + past/future slider (full width) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl overflow-hidden relative scan-line min-h-0"
        >
          <div className="absolute top-4 left-4 z-10">
            <h2 className="font-display text-sm font-semibold text-foreground/80 uppercase tracking-wider">
              Your money map
            </h2>
            <p className="text-xs text-muted-foreground mt-1 hidden sm:block">Tap a bubble to open that area</p>
          </div>
          <div className="h-[260px] sm:h-[360px] xl:h-[420px] min-h-[260px]">
            <FinancialNexus
              simulatedMonths={simulatedMonths}
            />
          </div>
          {/* Look back / ahead slider */}
          <div className="p-3 sm:p-4 border-t border-border/50 bg-background/50 min-w-0 overflow-x-hidden">
            <TimeMachineControls
              simulatedMonthsIntoFuture={simulatedMonths}
              onMonthsChange={setSimulatedMonths}
            />
            <TimeMachineInsights simulatedMonths={simulatedMonths} />
          </div>
        </motion.div>

        {/* Cards grid - fills all available space, uniform rows, scroll when content overflows */}
        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 [grid-auto-rows:minmax(280px,1fr)]">
          <div className="flex flex-col min-h-0 overflow-hidden rounded-2xl">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <FinancialWellnessScore />
            </div>
          </div>
          <div className="flex flex-col min-h-0 overflow-hidden rounded-2xl">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <BudgetPortPreview />
            </div>
          </div>
          <div className="flex flex-col min-h-0 overflow-hidden rounded-2xl">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <RecentTransactions simulatedMonths={simulatedMonths} />
            </div>
          </div>
          <div className="flex flex-col min-h-0 overflow-hidden rounded-2xl">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <SmartPredictionsFeed />
            </div>
          </div>
          <div className="flex flex-col min-h-0 overflow-hidden rounded-2xl">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AnomalySummaryCard />
            </div>
          </div>
          <div className="flex flex-col min-h-0 overflow-hidden rounded-2xl">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <SpendingAlertsCard />
            </div>
          </div>
          <div className="flex flex-col min-h-0 overflow-hidden rounded-2xl">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <NotificationsPanel />
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
