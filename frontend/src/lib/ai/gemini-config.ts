/**
 * Generative Language API — generateContent endpoint.
 * `gemini-1.5-flash` returns 404 for many keys; use a current stable model ID.
 * @see https://ai.google.dev/gemini-api/docs/models/gemini
 */
export const GEMINI_MODEL_ID = "gemini-2.5-flash";

export function getGeminiGenerateContentUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL_ID}:generateContent`;
}

/** Gemini 2.5 uses “thinking” by default; that consumes output budget and can truncate visible text. */
export const GEMINI_THINKING_OFF = {
  thinkingBudget: 0,
} as const;

type GenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

/**
 * Join all text parts (2.5+ may split answer across parts or mix with thought summaries).
 */
export function extractGeminiTextFromResponse(json: unknown): string {
  const r = json as GenerateContentResponse;
  const parts = r?.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p?.text)
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .join("\n")
    .trim();
}
