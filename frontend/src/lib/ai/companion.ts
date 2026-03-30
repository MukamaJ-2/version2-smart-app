import { aiService } from "./ai-service";
import type { TrainingTransaction } from "./training-data";
import {
  buildRAGDocuments,
  retrieve,
  formatRetrievedContext,
} from "./rag-retriever";
import {
  extractGeminiTextFromResponse,
  getGeminiGenerateContentUrl,
  GEMINI_THINKING_OFF,
} from "./gemini-config";

export interface CompanionGoal {
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyContribution: number;
  deadline: string;
}

export interface CompanionContext {
  goals?: CompanionGoal[];
  lastUserMessage?: string;
}

/* ───────── Gemini LLM Integration ───────── */

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

async function buildFinancialSystemPrompt(ragContext?: string): Promise<string> {
  const insights = await aiService.getDashboardInsightsAsync();
  const savingsRate = Math.max(0, insights.savingsRate);

  const top = insights.topCategories
    .slice(0, 5)
    .map((c) => `${c.category}: ${c.amount.toLocaleString()} UGX (${c.percentage}%)`)
    .join(", ");

  const modelBlock = insights.modelSignals ? "\n\n" + insights.modelSignals.summaryForPrompt : "";

  const base = [
    "You are a smart, friendly AI financial advisor named UniGuard embedded in a personal finance app for users based in Uganda.",
    "Always respond in 2–5 concise sentences unless the user asks for more detail.",
    "Use Ugandan Shilling (UGX) when mentioning money amounts.",
    "Do NOT make up data. Only reference the financial data provided below.",
    "When MODEL-ASSISTED SIGNALS are present, you may briefly mention data quality (miscellaneous share) or unusual expenses (local checks plus trained RF when available) — and suggest reviewing Transactions if anomalies are flagged.",
    "",
    "=== USER FINANCIAL SNAPSHOT ===",
    `Total Income: ${insights.totalIncome.toLocaleString()} UGX`,
    `Total Expenses: ${insights.totalSpending.toLocaleString()} UGX`,
    `Net: ${(insights.totalIncome - insights.totalSpending).toLocaleString()} UGX`,
    `Savings Rate: ${savingsRate}%`,
    `Transaction Count: ${insights.transactionCount}`,
    `Top Spending Categories: ${top || "none yet"}`,
    "=== END SNAPSHOT ===",
    modelBlock,
  ].join("\n");

  if (ragContext) {
    return base + "\n\n" + ragContext + "\n\nUse the retrieved context above when relevant to the user's question.";
  }
  return base;
}

async function callGemini(
  userMessage: string,
  context: CompanionContext
): Promise<string | null> {
  if (!GEMINI_API_KEY) return null;

  // RAG: retrieve relevant context for the query
  const transactions = aiService.getTransactions();
  const insights = await aiService.getDashboardInsightsAsync();
  const goals = context.goals ?? [];
  const docs = buildRAGDocuments(
    transactions.map((t) => ({
      description: t.description,
      amount: t.amount,
      category: t.category,
      type: t.type,
      date: t.date,
    })),
    goals.map((g) => ({
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      monthlyContribution: g.monthlyContribution,
      deadline: g.deadline,
    })),
    {
      totalIncome: insights.totalIncome,
      totalSpending: insights.totalSpending,
      savingsRate: insights.savingsRate,
      topCategories: insights.topCategories,
    }
  );
  const retrieved = retrieve(userMessage, docs, 5);
  const ragContext = formatRetrievedContext(retrieved);

  const systemPrompt = await buildFinancialSystemPrompt(ragContext);

  // Add goal context if available
  let goalContext = "";
  if (context.goals && context.goals.length > 0) {
    goalContext =
      "\n=== USER GOALS ===\n" +
      context.goals
        .map(
          (g) =>
            `${g.name}: target ${g.targetAmount.toLocaleString()} UGX, saved ${g.currentAmount.toLocaleString()} UGX, ` +
            `contributing ${g.monthlyContribution.toLocaleString()} UGX/month, deadline ${g.deadline}`
        )
        .join("\n") +
      "\n=== END GOALS ===";
  }

  const fullPrompt = systemPrompt + goalContext;

  try {
    const res = await fetch(`${getGeminiGenerateContentUrl()}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: fullPrompt }] },
        contents: [
          ...(context.lastUserMessage
            ? [
                { role: "user", parts: [{ text: context.lastUserMessage }] },
                {
                  role: "model",
                  parts: [
                    {
                      text: "Understood. Based on your financial data, I can help with that.",
                    },
                  ],
                },
              ]
            : []),
          { role: "user", parts: [{ text: userMessage }] },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
          topP: 0.95,
          thinkingConfig: GEMINI_THINKING_OFF,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        ],
      }),
    });

    if (!res.ok) {
      console.warn("[Gemini] API error", res.status);
      return null;
    }

    const json = await res.json();
    const text = extractGeminiTextFromResponse(json);
    return text.length > 0 ? text : null;
  } catch (err) {
    console.warn("[Gemini] fetch failed", err);
    return null;
  }
}

/* ───────── Helpers ───────── */

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: "UGX",
    maximumFractionDigits: 0,
  }).format(Math.max(amount, 0));
}

function buildSpendingSummary(detailed = false): string {
  const insights = aiService.getDashboardInsights();
  if (insights.transactionCount === 0) {
    return "I don't have enough transaction data yet. Add a few transactions and I can analyze your spending patterns.";
  }
  const top = insights.topCategories.slice(0, detailed ? 5 : 3);
  const topText =
    top.length > 0
      ? top.map((item) => `${item.category} (${item.percentage}%)`).join(", ")
      : "no dominant categories yet";
  const lines = [
    `Your top spending categories are ${topText}.`,
    `Total spending: ${formatCurrency(insights.totalSpending)} across ${insights.transactionCount} transactions.`,
  ];
  if (detailed && top.length > 0) {
    lines.push(
      "Breakdown: " +
        top.map((item) => `${item.category} ${formatCurrency(item.amount)}`).join("; ") +
        "."
    );
  }
  lines.push("Ask me for budget tips or goal recommendations.");
  return lines.join("\n");
}

function buildBudgetTips(): string {
  const insights = aiService.getDashboardInsights();
  const savingsRate = Math.max(0, insights.savingsRate);
  const top = insights.topCategories.slice(0, 2);
  const topTip =
    top.length > 0
      ? `Focus on ${top.map((i) => i.category).join(" and ")} to find quick savings.`
      : "Track two categories consistently for a week to identify easy wins.";
  const suggestion = aiService.suggestBudgetAllocation(
    Math.max(0, insights.totalIncome - insights.totalSpending),
    {},
    []
  );
  const suggestedCategories =
    suggestion?.allocations?.length > 0
      ? suggestion.allocations
          .slice(0, 3)
          .map((a) => `${a.category}: ${formatCurrency(a.suggestedAmount)}`)
          .join("; ")
      : null;
  const lines = [
    `Your current savings rate is ${savingsRate}%.`,
    topTip,
    "Try setting a weekly cap for discretionary categories.",
  ];
  if (suggestedCategories) lines.push(`Suggested allocation for surplus: ${suggestedCategories}`);
  return lines.join("\n");
}

function buildHealthSummary(): string {
  const insights = aiService.getDashboardInsights();
  if (insights.totalIncome <= 0) {
    return "I need at least one income entry to estimate your financial health score.";
  }
  const savingsRate = Math.max(0, insights.savingsRate);
  const score = Math.min(95, Math.max(35, 50 + Math.round(savingsRate * 0.6)));
  return [
    `Your financial health score is ${score}/100.`,
    `Savings rate: ${savingsRate}%.`,
    "Keep income and expense entries up to date for more precise insights.",
  ].join("\n");
}

function buildGoalResponse(context?: CompanionContext): string {
  const goals = context?.goals ?? [];
  if (goals.length === 0) {
    return "Add a goal with a target, deadline, and monthly contribution — I'll estimate completion probability.";
  }
  const activeGoals = goals.map((g) => ({ monthlyContribution: g.monthlyContribution }));
  const lines: string[] = ["Here's your goal outlook:"];
  for (const goal of goals) {
    const prediction = aiService.predictGoal(
      { name: goal.name, targetAmount: goal.targetAmount, currentAmount: goal.currentAmount, monthlyContribution: goal.monthlyContribution, deadline: goal.deadline },
      activeGoals
    );
    const pct = Math.round(prediction.completionProbability * 100);
    lines.push(`• ${goal.name}: ${prediction.successLikelihood} (${pct}% probability, ~${prediction.monthsToComplete} months).`);
  }
  lines.push("Keep contributions steady or increase them to improve likelihood.");
  return lines.join("\n");
}

function matchIntent(input: string, phrases: string[]): boolean {
  const lower = input.toLowerCase().trim();
  return phrases.some((p) => lower.includes(p.toLowerCase()));
}

/* ───────── Proactive Nudges ───────── */

export interface ProactiveNudge {
  id: string;
  message: string;
  type: "warning" | "positive" | "info";
  action: string;
  priority: number;
}

export function generateProactiveNudges(): ProactiveNudge[] {
  const insights = aiService.getDashboardInsights();
  if (insights.transactionCount === 0) return [];

  const nudges: ProactiveNudge[] = [];
  const savingsRate = Math.min(100, Math.max(0, insights.savingsRate));
  const top = insights.topCategories;

  if (savingsRate < 10 && insights.totalIncome > 0) {
    nudges.push({ id: "low-savings", message: `Your savings rate is only ${savingsRate}% — financial experts recommend at least 20%. Even saving a small amount consistently helps.`, type: "warning", action: "Get savings tips", priority: 90 });
  } else if (savingsRate >= 30) {
    nudges.push({ id: "great-savings", message: `Amazing! You're saving ${savingsRate}% of your income — above the recommended 20%. Consider channeling more into your goals.`, type: "positive", action: "View goals", priority: 40 });
  }
  if (top.length > 0 && top[0].percentage > 50) {
    const pct = Math.min(100, top[0].percentage);
    nudges.push({ id: "high-category", message: `${top[0].category} makes up ${pct}% of your spending. Diversifying expenses reduces financial risk.`, type: "warning", action: "Analyze spending", priority: 70 });
  }
  if (insights.totalIncome > 0 && insights.totalSpending > insights.totalIncome * 0.95) {
    const pct = Math.min(100, Math.round((insights.totalSpending / insights.totalIncome) * 100));
    nudges.push({ id: "over-spending", message: `You're spending ${pct}% of your income. A 5–10% buffer prevents month-end shortfalls.`, type: "warning", action: "Budget tips", priority: 95 });
  }
  if (savingsRate >= 15 && savingsRate < 30) {
    nudges.push({ id: "moderate-savings", message: `You're saving ${savingsRate}% — solid! Boost it by just 5% more to hit the recommended sweet spot.`, type: "info", action: "See how", priority: 30 });
  }
  if (insights.transactionCount > 50) {
    nudges.push({ id: "data-rich", message: `With ${insights.transactionCount} transactions tracked, your analytics are very accurate. Check Reports for detailed trends.`, type: "positive", action: "View reports", priority: 20 });
  }

  return nudges.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

/* ───────── Rule-Based Fallback ───────── */

function buildComparisonResponse(): string {
  const insights = aiService.getDashboardInsights();
  if (insights.transactionCount === 0) {
    return "I need transaction data to compare periods. Add some transactions first!";
  }
  const lines = [
    "Here's your financial snapshot:",
    `• Total Income: ${formatCurrency(insights.totalIncome)}`,
    `• Total Spending: ${formatCurrency(insights.totalSpending)}`,
    `• Net: ${formatCurrency(insights.totalIncome - insights.totalSpending)}`,
    `• Savings Rate: ${Math.min(100, Math.max(0, insights.savingsRate))}%`,
  ];
  if (insights.topCategories.length > 0) {
    lines.push("", "Top spending areas:");
    insights.topCategories.slice(0, 4).forEach((cat) => {
      lines.push(`  ${cat.category}: ${formatCurrency(cat.amount)} (${cat.percentage}%)`);
    });
  }
  lines.push("", "Ask me for budget tips or goal recommendations!");
  return lines.join("\n");
}

function buildGreeting(): string {
  const insights = aiService.getDashboardInsights();
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  if (insights.transactionCount === 0) {
    return [`${timeGreeting}! I'm your AI financial companion.`, "", "I can help you:", "• Analyze spending patterns", "• Give budget tips", "• Predict goal completion", "• Monitor financial health", "", "Ask me anything about your finances!"].join("\n");
  }
  const savingsRate = Math.min(100, Math.max(0, insights.savingsRate));
  const topCategory = insights.topCategories[0];
  return [
    `${timeGreeting}! Here's a quick pulse:`,
    "",
    `${insights.transactionCount} transactions tracked`,
    `Savings rate: ${savingsRate}%${savingsRate >= 20 ? " (great!)" : " — let's improve this!"}`,
    topCategory ? `Top spending: ${topCategory.category} (${topCategory.percentage}%)` : "",
    "",
    "What would you like to know?",
  ].filter(Boolean).join("\n");
}

function ruleBasedResponse(
  input: string,
  context?: CompanionContext
): { content: string; suggestions: string[] } {
  const lowerInput = input.toLowerCase().trim();
  const last = context?.lastUserMessage?.toLowerCase().trim() ?? "";

  const spendingPhrases = ["spend", "expense", "expenses", "spending", "how much did i spend", "where did my money go", "top categories", "categories", "breakdown"];
  const goalPhrases = ["goal", "target", "will i reach", "goal progress", "on track"];
  const budgetPhrases = ["budget", "tip", "tips", "optimize", "save more", "allocation", "savings"];
  const healthPhrases = ["health", "score", "financial health", "how am i doing", "overall"];
  const followUpPhrases = ["tell me more", "dig deeper", "more detail", "breakdown", "elaborate"];
  const comparisonPhrases = ["compare", "snapshot", "summary", "overview", "how much", "net worth"];
  const greetingPhrases = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "what can you do"];

  const isFollowUp = matchIntent(lowerInput, followUpPhrases) && last.length > 0;
  const isSpendingLast = matchIntent(last, spendingPhrases);

  if (isFollowUp && isSpendingLast) return { content: buildSpendingSummary(true), suggestions: ["Budget tips", "Goal progress", "Health score"] };
  if (matchIntent(lowerInput, greetingPhrases)) return { content: buildGreeting(), suggestions: ["Spending analysis", "Budget tips", "Goal progress", "Financial health"] };
  if (matchIntent(lowerInput, spendingPhrases)) return { content: buildSpendingSummary(false), suggestions: ["Show budget tips", "Analyze a category", "Goal progress"] };
  if (matchIntent(lowerInput, goalPhrases)) return { content: buildGoalResponse(context), suggestions: ["Spending analysis", "Budget tips", "Health score"] };
  if (matchIntent(lowerInput, budgetPhrases)) return { content: buildBudgetTips(), suggestions: ["Spending analysis", "Health score", "Goal progress"] };
  if (matchIntent(lowerInput, healthPhrases)) return { content: buildHealthSummary(), suggestions: ["Spending analysis", "Budget tips", "Goal progress"] };
  if (matchIntent(lowerInput, comparisonPhrases)) return { content: buildComparisonResponse(), suggestions: ["Budget tips", "Goal progress", "Health score"] };
  return { content: buildGreeting(), suggestions: ["Spending analysis", "Budget tips", "Goal progress", "Financial health"] };
}

/* ───────── Main Export: LLM-first, rule-based fallback ───────── */

export async function buildAiResponse(
  input: string,
  context?: CompanionContext
): Promise<{ content: string; suggestions: string[]; usedLLM?: boolean }> {
  // Try Gemini first
  const llmReply = await callGemini(input, context ?? {});
  if (llmReply) {
    // Smart suggestions based on what was asked
    const lower = input.toLowerCase();
    const suggestions = lower.includes("goal")
      ? ["Spending analysis", "Budget tips", "Health score"]
      : lower.includes("budget") || lower.includes("tip")
      ? ["Spending analysis", "Goal progress", "Health score"]
      : ["Budget tips", "Goal progress", "Financial health"];
    return { content: llmReply, suggestions, usedLLM: true };
  }

  // Fallback to rule-based
  const fallback = ruleBasedResponse(input, context);
  return { ...fallback, usedLLM: false };
}

// Keep sync version for callers that haven't been updated yet
export function buildAiResponseSync(
  input: string,
  context?: CompanionContext
): { content: string; suggestions: string[] } {
  return ruleBasedResponse(input, context);
}
