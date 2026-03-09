import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Activity, Moon, Sun, User, Pencil, Target } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import FinancialNexus from "@/components/nexus/FinancialNexus";
import { TimeMachineControls } from "@/components/nexus/TimeMachineControls";
import AppLayout from "@/components/layout/AppLayout";
import QuickStats from "@/components/dashboard/QuickStats";
import FluxPodPreview from "@/components/dashboard/FluxPodPreview";
import RecentTransactions from "@/components/dashboard/RecentTransactions";
import NotificationsPanel from "@/components/dashboard/NotificationsPanel";
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
      <div className="min-h-screen p-6 space-y-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {profile?.name ? (
                <>Welcome back, {profile.name.split(/\s+/)[0]}</>
              ) : (
                "Uniguard Hub"
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {lifeStageLabel
                ? `Your financial command center · ${lifeStageLabel}`
                : "Your financial command center"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="border-border hover:border-primary/50"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-xl">
              <Activity className="w-4 h-4 text-success animate-pulse" />
              <span className="text-sm font-mono text-foreground">System Online</span>
            </div>
          </div>
        </motion.header>

        {/* Quick Stats */}
        <QuickStats simulatedMonths={simulatedMonths} />

        {/* Your profile summary (from onboarding) */}
        {answers && (lifeStageLabel || savingsGoalLabel || alertLabel || essentialCount > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-xl p-4 border border-border"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-display text-sm font-semibold text-foreground">
                  Based on your profile
                </h2>
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


        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 3D Finance Overview */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="xl:col-span-2 glass-card rounded-2xl overflow-hidden relative scan-line"
          >
            <div className="absolute top-4 left-4 z-10">
              <h2 className="font-display text-sm font-semibold text-foreground/80 uppercase tracking-wider">
                Finance Overview
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Interactive 3D visualization</p>
            </div>
            <div className="h-[500px]">
              <FinancialNexus
                simulatedMonths={simulatedMonths}
              />
            </div>
            {/* Time Machine Simulator */}
            <div className="p-4 border-t border-border/50 bg-background/50">
              <TimeMachineControls
                simulatedMonthsIntoFuture={simulatedMonths}
                onMonthsChange={setSimulatedMonths}
              />
            </div>
          </motion.div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Flux Pods Preview */}
            <FluxPodPreview />

            {/* Recent Activity */}
            <RecentTransactions />

            {/* Notifications */}
            <NotificationsPanel />
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
