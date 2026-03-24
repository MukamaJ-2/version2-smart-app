/**
 * RAG (Retrieval Augmented Generation) for AI Companion
 * Lightweight keyword-based retrieval - indexes financial data and retrieves
 * relevant context for user queries. No external embedding API required.
 */

export interface RAGDocument {
  id: string;
  type: "transaction" | "goal" | "budget" | "summary";
  text: string;
  metadata?: Record<string, unknown>;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function buildIndex(docs: RAGDocument[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  docs.forEach((doc) => {
    const tokens = tokenize(doc.text);
    tokens.forEach((t) => {
      if (!index.has(t)) index.set(t, new Set());
      index.get(t)!.add(doc.id);
    });
  });
  return index;
}

function bm25Score(
  queryTokens: string[],
  doc: RAGDocument,
  index: Map<string, Set<string>>,
  totalDocs: number
): number {
  const docTokens = tokenize(doc.text);
  const docLen = docTokens.length;
  const avgDocLen = 50;
  const k1 = 1.5;
  const b = 0.75;

  let score = 0;
  const docTokenSet = new Set(docTokens);

  queryTokens.forEach((qt) => {
    const docIdsWithTerm = index.get(qt);
    if (!docIdsWithTerm || !docIdsWithTerm.has(doc.id)) return;

    const tf = docTokens.filter((t) => t === qt).length;
    const idf = Math.log((totalDocs - docIdsWithTerm.size + 0.5) / (docIdsWithTerm.size + 0.5) + 1);
    const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * (docLen / avgDocLen)));
    score += idf * norm;
  });

  return score;
}

/**
 * Build RAG documents from user financial data
 */
export function buildRAGDocuments(
  transactions: Array<{ description: string; amount: number; category: string; type: string; date: string }>,
  goals: Array<{ name: string; targetAmount: number; currentAmount: number; monthlyContribution: number; deadline: string }>,
  budgetSummary: { totalIncome: number; totalSpending: number; savingsRate: number; topCategories: Array<{ category: string; amount: number; percentage: number }> }
): RAGDocument[] {
  const docs: RAGDocument[] = [];

  transactions.slice(0, 100).forEach((tx, i) => {
    docs.push({
      id: `tx-${i}`,
      type: "transaction",
      text: `${tx.type} ${tx.amount} ${tx.category} ${tx.description} ${tx.date}`,
      metadata: { amount: tx.amount, category: tx.category, type: tx.type },
    });
  });

  goals.forEach((g, i) => {
    const pct = g.targetAmount > 0 ? Math.round((g.currentAmount / g.targetAmount) * 100) : 0;
    docs.push({
      id: `goal-${i}`,
      type: "goal",
      text: `goal ${g.name} target ${g.targetAmount} current ${g.currentAmount} ${pct}% monthly ${g.monthlyContribution} deadline ${g.deadline}`,
      metadata: { name: g.name, targetAmount: g.targetAmount, currentAmount: g.currentAmount },
    });
  });

  docs.push({
    id: "summary",
    type: "summary",
    text: `income ${budgetSummary.totalIncome} spending ${budgetSummary.totalSpending} savings rate ${budgetSummary.savingsRate}% top categories ${budgetSummary.topCategories.map((c) => `${c.category} ${c.amount} ${c.percentage}%`).join(" ")}`,
    metadata: budgetSummary,
  });

  return docs;
}

/**
 * Retrieve top-k documents relevant to the query
 */
export function retrieve(
  query: string,
  documents: RAGDocument[],
  topK = 5
): RAGDocument[] {
  if (documents.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return documents.slice(0, topK);

  const index = buildIndex(documents);
  const scored = documents
    .map((doc) => ({
      doc,
      score: bm25Score(queryTokens, doc, index, documents.length),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.doc);

  if (scored.length > 0) return scored;

  return documents.slice(0, topK);
}

/**
 * Format retrieved documents as context string for LLM/prompt
 */
export function formatRetrievedContext(docs: RAGDocument[]): string {
  if (docs.length === 0) return "";

  const parts: string[] = ["=== RETRIEVED RELEVANT CONTEXT ==="];
  docs.forEach((d) => {
    parts.push(`[${d.type}] ${d.text}`);
  });
  parts.push("=== END CONTEXT ===");
  return parts.join("\n");
}
