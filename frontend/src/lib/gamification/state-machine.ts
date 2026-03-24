/**
 * State-Machine Gamification
 * User progresses through tiers based on financial behavior and achievements.
 */

export type GamificationState =
  | "novice"
  | "learner"
  | "adept"
  | "expert"
  | "master"
  | "legend";

export interface GamificationContext {
  totalPoints: number;
  goalsCompleted: number;
  goalsTotal: number;
  budgetPortsCount: number;
  transactionsCount: number;
  currentStreak: number;
  savingsAmount: number;
  achievementsUnlocked: number;
  daysActive: number;
}

export interface StateDefinition {
  id: GamificationState;
  label: string;
  description: string;
  minPoints: number;
  requirements: Partial<{
    goalsCompleted: number;
    budgetPortsCount: number;
    transactionsCount: number;
    currentStreak: number;
    savingsAmount: number;
    achievementsUnlocked: number;
    daysActive: number;
  }>;
  rewards: string[];
  color: string;
  icon: string;
}

const STATE_DEFINITIONS: StateDefinition[] = [
  {
    id: "novice",
    label: "Novice",
    description: "Just getting started on your financial journey",
    minPoints: 0,
    requirements: {},
    rewards: ["Basic tracking", "Transaction logging"],
    color: "text-muted-foreground",
    icon: "🌱",
  },
  {
    id: "learner",
    label: "Learner",
    description: "Building habits and tracking consistently",
    minPoints: 50,
    requirements: { transactionsCount: 10, budgetPortsCount: 1 },
    rewards: ["Budgets", "Spending by category"],
    color: "text-blue-500",
    icon: "📚",
  },
  {
    id: "adept",
    label: "Adept",
    description: "Managing budgets and making progress",
    minPoints: 150,
    requirements: {
      transactionsCount: 30,
      budgetPortsCount: 3,
      goalsCompleted: 0,
      currentStreak: 3,
    },
    rewards: ["Goal tracking", "Streak bonuses"],
    color: "text-green-500",
    icon: "⭐",
  },
  {
    id: "expert",
    label: "Expert",
    description: "Strong financial discipline and goal focus",
    minPoints: 350,
    requirements: {
      transactionsCount: 75,
      budgetPortsCount: 5,
      goalsCompleted: 1,
      currentStreak: 7,
      savingsAmount: 500000,
    },
    rewards: ["Advanced insights", "Priority support"],
    color: "text-purple-500",
    icon: "🏆",
  },
  {
    id: "master",
    label: "Master",
    description: "Exceptional financial control",
    minPoints: 600,
    requirements: {
      transactionsCount: 150,
      budgetPortsCount: 6,
      goalsCompleted: 3,
      currentStreak: 14,
      savingsAmount: 2000000,
      achievementsUnlocked: 8,
    },
    rewards: ["Master badge", "Exclusive features"],
    color: "text-amber-500",
    icon: "👑",
  },
  {
    id: "legend",
    label: "Legend",
    description: "Elite financial mastery",
    minPoints: 1000,
    requirements: {
      transactionsCount: 300,
      budgetPortsCount: 7,
      goalsCompleted: 5,
      currentStreak: 30,
      savingsAmount: 5000000,
      achievementsUnlocked: 15,
      daysActive: 90,
    },
    rewards: ["Legend status", "Hall of fame"],
    color: "text-rose-500",
    icon: "💎",
  },
];

function meetsRequirements(
  ctx: GamificationContext,
  req: StateDefinition["requirements"]
): boolean {
  if (!req) return true;
  if (req.goalsCompleted != null && ctx.goalsCompleted < req.goalsCompleted) return false;
  if (req.budgetPortsCount != null && ctx.budgetPortsCount < req.budgetPortsCount) return false;
  if (req.transactionsCount != null && ctx.transactionsCount < req.transactionsCount) return false;
  if (req.currentStreak != null && ctx.currentStreak < req.currentStreak) return false;
  if (req.savingsAmount != null && ctx.savingsAmount < req.savingsAmount) return false;
  if (req.achievementsUnlocked != null && ctx.achievementsUnlocked < req.achievementsUnlocked) return false;
  if (req.daysActive != null && ctx.daysActive < req.daysActive) return false;
  return true;
}

export function computeGamificationState(ctx: GamificationContext): {
  state: GamificationState;
  definition: StateDefinition;
  progressToNext: number;
  nextState: StateDefinition | null;
} {
  let current: StateDefinition = STATE_DEFINITIONS[0];
  let next: StateDefinition | null = null;

  for (let i = STATE_DEFINITIONS.length - 1; i >= 0; i--) {
    const def = STATE_DEFINITIONS[i];
    if (ctx.totalPoints >= def.minPoints && meetsRequirements(ctx, def.requirements)) {
      current = def;
      if (i < STATE_DEFINITIONS.length - 1) {
        next = STATE_DEFINITIONS[i + 1];
      }
      break;
    }
  }

  let progressToNext = 1;
  if (next) {
    const pointsNeeded = next.minPoints - current.minPoints;
    const pointsProgress = ctx.totalPoints - current.minPoints;
    progressToNext = Math.min(1, Math.max(0, pointsProgress / Math.max(pointsNeeded, 1)));
  }

  return {
    state: current.id,
    definition: current,
    progressToNext,
    nextState: next,
  };
}

export function getStateDefinitions(): StateDefinition[] {
  return [...STATE_DEFINITIONS];
}
