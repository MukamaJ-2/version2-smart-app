export type {
  SmartMoneyEvaluation,
  SmartMoneyInsights,
  SmartMoneyMetrics,
  SmartMoneyPipelineResult,
  SmartMoneyTransactionInput,
  TraceEvent,
} from "./types";
export type { InsightModelSignals } from "@/lib/ai/insightModelSignals";
export {
  computeInsights,
  evaluateCategorization,
  generateBaselineReport,
  runSmartMoneyPipeline,
  runSmartMoneyPipelineAsync,
  type RunPipelineOptions,
} from "./pipeline";
export { fetchSmartMoneyAdvice } from "./gemini-advisor";
export { plainTextFromAiAdvice } from "./format-ai-text";
