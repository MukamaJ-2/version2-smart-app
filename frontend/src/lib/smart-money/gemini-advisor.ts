import type { SmartMoneyInsights } from "./types";
import {
  extractGeminiTextFromResponse,
  getGeminiGenerateContentUrl,
  GEMINI_THINKING_OFF,
} from "@/lib/ai/gemini-config";
import { plainTextFromAiAdvice } from "./format-ai-text";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

/**
 * Natural-language layer on top of numeric insights + baseline report (customer data only in inputs).
 */
export async function fetchSmartMoneyAdvice(
  insights: SmartMoneyInsights,
  baselineReport: string,
  monthlyBudgetUgx: number | null | undefined,
  /** Optional: category quality + anomaly summary for richer tips */
  modelSignalPromptBlock?: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return (
      "AI advice is unavailable (add VITE_GEMINI_API_KEY). Baseline summary:\n\n" + baselineReport
    );
  }

  const budgetLine =
    monthlyBudgetUgx != null && monthlyBudgetUgx > 0
      ? `Stated monthly budget: ${monthlyBudgetUgx.toLocaleString()} UGX.`
      : "No monthly budget was provided.";

  const prompt = `You are UniGuard X-T's personal finance assistant for users in Uganda.
Use Ugandan Shilling (UGX) only. Do not invent transactions or amounts.

OUTPUT RULES (required):
- Plain text only. Do NOT use markdown: no asterisks, no **bold**, no # headings, no backticks.
- Be brief: at most ~100 words total.
- Structure: one short paragraph (2–3 sentences) summarizing spending, then a line "Tips:" followed by four numbered lines; each tip is one short sentence only.

Numeric insights (from the user's own app data, expenses only):
${JSON.stringify(
  {
    totalSpend: insights.totalSpend,
    spendByCategory: insights.spendByCategory,
    spendByMonth: insights.spendByMonth,
    expenseTransactionCount: insights.expenseTransactionCount,
  },
  null,
  2
)}

${budgetLine}

Baseline report:
"""${baselineReport}"""

${modelSignalPromptBlock ? `Model-assisted signals (use for one tip if relevant; do not invent numbers):\n"""${modelSignalPromptBlock}"""\n` : ""}

Follow the OUTPUT RULES above.`;

  try {
    const res = await fetch(`${getGeminiGenerateContentUrl()}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.55,
          maxOutputTokens: 512,
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
      return `Could not reach the AI advisor (${res.status}).\n\n${baselineReport}`;
    }

    const json = await res.json();
    const text = extractGeminiTextFromResponse(json);
    if (text) return plainTextFromAiAdvice(text);

    const err = json as { promptFeedback?: { blockReason?: string }; error?: { message?: string } };
    const why =
      err?.promptFeedback?.blockReason ||
      err?.error?.message ||
      "empty model response";
    return `AI advice could not be generated (${why}).\n\n${baselineReport}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `AI advice failed (${msg}).\n\n${baselineReport}`;
  }
}
