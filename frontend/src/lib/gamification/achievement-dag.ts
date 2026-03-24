/**
 * Achievement Dependency Graph (DAG)
 * Models prerequisites between achievements. Computes topological order,
 * next achievable, and unlock paths.
 */

export interface AchievementNode {
  id: string;
  prerequisites: string[];
}

const ACHIEVEMENT_DAG: AchievementNode[] = [
  { id: "first-steps", prerequisites: [] },
  { id: "ten-transactions", prerequisites: ["first-steps"] },
  { id: "fifty-transactions", prerequisites: ["ten-transactions"] },
  { id: "goal-getter", prerequisites: ["first-steps"] },
  { id: "goal-finisher", prerequisites: ["goal-getter"] },
  { id: "goal-crusher", prerequisites: ["goal-finisher"] },
  { id: "savings-100k", prerequisites: ["first-steps"] },
  { id: "savings-500k", prerequisites: ["savings-100k"] },
  { id: "savings-master", prerequisites: ["savings-500k"] },
  { id: "millionaire", prerequisites: ["savings-master"] },
  { id: "pod-creator", prerequisites: ["first-steps"] },
  { id: "pod-master", prerequisites: ["pod-creator"] },
  { id: "streak-7", prerequisites: ["ten-transactions"] },
  { id: "streak-30", prerequisites: ["streak-7"] },
  { id: "smart-spender", prerequisites: ["ten-transactions"] },
  { id: "diverse-tracker", prerequisites: ["ten-transactions"] },
];

const idToNode = new Map<string, AchievementNode>();
ACHIEVEMENT_DAG.forEach((n) => idToNode.set(n.id, n));

function topologicalSort(): string[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  ACHIEVEMENT_DAG.forEach((n) => {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  });

  ACHIEVEMENT_DAG.forEach((n) => {
    n.prerequisites.forEach((p) => {
      if (idToNode.has(p)) {
        inDegree.set(n.id, (inDegree.get(n.id) ?? 0) + 1);
        const list = adj.get(p) ?? [];
        list.push(n.id);
        adj.set(p, list);
      }
    });
  });

  const queue: string[] = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    (adj.get(id) ?? []).forEach((childId) => {
      const newDeg = (inDegree.get(childId) ?? 0) - 1;
      inDegree.set(childId, newDeg);
      if (newDeg === 0) queue.push(childId);
    });
  }
  return order;
}

const TOPO_ORDER = topologicalSort();

/**
 * Get achievements that can be unlocked next (all prerequisites met, not yet unlocked)
 */
export function getNextAchievable(
  unlockedIds: Set<string>,
  achievementIds: string[]
): string[] {
  const next: string[] = [];
  for (const id of TOPO_ORDER) {
    if (unlockedIds.has(id)) continue;
    if (!achievementIds.includes(id)) continue;

    const node = idToNode.get(id);
    if (!node) continue;

    const allPrereqsMet = node.prerequisites.every((p) => unlockedIds.has(p));
    if (allPrereqsMet) next.push(id);
  }
  return next;
}

/**
 * Get prerequisites for an achievement
 */
export function getPrerequisites(achievementId: string): string[] {
  return idToNode.get(achievementId)?.prerequisites ?? [];
}

/**
 * Get achievements that depend on this one (children in DAG)
 */
export function getDependents(achievementId: string): string[] {
  return ACHIEVEMENT_DAG.filter((n) => n.prerequisites.includes(achievementId)).map((n) => n.id);
}

/**
 * Check if all prerequisites for an achievement are unlocked
 */
export function canUnlock(achievementId: string, unlockedIds: Set<string>): boolean {
  const prereqs = getPrerequisites(achievementId);
  return prereqs.every((p) => unlockedIds.has(p));
}
