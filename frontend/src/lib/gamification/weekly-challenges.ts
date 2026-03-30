/**
 * Time-bound weekly challenges: progress from real transactions, bonus points
 * stored in localStorage (no extra Supabase tables).
 */

const STORAGE_KEY = "spf-weekly-challenges-v1";

export interface WeeklyTx {
  id: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
}

export interface WeeklyChallengeDef {
  id: string;
  title: string;
  description: string;
  bonusPoints: number;
  compute: (
    txs: WeeklyTx[],
    weekStart: Date,
    weekEnd: Date
  ) => { progress: number; target: number; complete: boolean };
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function inWeek(dateStr: string, weekStart: Date, weekEnd: Date): boolean {
  const d = parseLocalDate(dateStr);
  return d >= weekStart && d < weekEnd;
}

export function getCurrentWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  monday.setHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  return { start: monday, end: nextMonday };
}

export function getWeekId(bounds: { start: Date }): string {
  return `${bounds.start.getFullYear()}-${String(bounds.start.getMonth() + 1).padStart(2, "0")}-${String(bounds.start.getDate()).padStart(2, "0")}`;
}

export const WEEKLY_CHALLENGE_DEFS: WeeklyChallengeDef[] = [
  {
    id: "week-logger",
    title: "Active week",
    description: "Log at least 5 transactions this week",
    bonusPoints: 15,
    compute: (txs, weekStart, weekEnd) => {
      const w = txs.filter((t) => inWeek(t.date, weekStart, weekEnd));
      const n = w.length;
      return { progress: Math.min(n, 5), target: 5, complete: n >= 5 };
    },
  },
  {
    id: "week-days",
    title: "Steady rhythm",
    description: "Record activity on 3 different days this week",
    bonusPoints: 20,
    compute: (txs, weekStart, weekEnd) => {
      const days = new Set(
        txs.filter((t) => inWeek(t.date, weekStart, weekEnd)).map((t) => t.date)
      );
      const n = days.size;
      return { progress: Math.min(n, 3), target: 3, complete: n >= 3 };
    },
  },
  {
    id: "week-categories",
    title: "Category explorer",
    description: "Use 3+ different expense categories this week",
    bonusPoints: 25,
    compute: (txs, weekStart, weekEnd) => {
      const cats = new Set(
        txs
          .filter((t) => inWeek(t.date, weekStart, weekEnd) && t.type === "expense")
          .map((t) => t.category)
      );
      const n = cats.size;
      return { progress: Math.min(n, 3), target: 3, complete: n >= 3 };
    },
  },
  {
    id: "week-in-the-green",
    title: "In the green",
    description: "End the week with income ≥ expenses (week to date)",
    bonusPoints: 30,
    compute: (txs, weekStart, weekEnd) => {
      const w = txs.filter((t) => inWeek(t.date, weekStart, weekEnd));
      const inc = w.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const exp = w.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const ok = inc >= exp && w.length > 0;
      return {
        progress: ok ? 1 : 0,
        target: 1,
        complete: ok,
      };
    },
  },
];

interface Persisted {
  weeks: Record<string, { claimed: Record<string, number> }>;
}

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { weeks: {} };
    const p = JSON.parse(raw) as Persisted;
    if (!p.weeks || typeof p.weeks !== "object") return { weeks: {} };
    return p;
  } catch {
    return { weeks: {} };
  }
}

function savePersisted(p: Persisted): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function getClaimedPointsForWeek(weekId: string): Record<string, number> {
  return { ...(loadPersisted().weeks[weekId]?.claimed ?? {}) };
}

export function claimWeeklyChallenge(weekId: string, challengeId: string, points: number): void {
  const p = loadPersisted();
  if (!p.weeks[weekId]) p.weeks[weekId] = { claimed: {} };
  if (p.weeks[weekId].claimed[challengeId] != null) return;
  p.weeks[weekId].claimed[challengeId] = points;
  savePersisted(p);
}

export function getTotalWeeklyBonusPoints(): number {
  let sum = 0;
  const { weeks } = loadPersisted();
  for (const w of Object.values(weeks)) {
    for (const pts of Object.values(w.claimed)) {
      sum += pts;
    }
  }
  return sum;
}

export function computeWeeklyChallenge(
  def: WeeklyChallengeDef,
  txs: WeeklyTx[],
  weekStart: Date,
  weekEnd: Date
) {
  return def.compute(txs, weekStart, weekEnd);
}
