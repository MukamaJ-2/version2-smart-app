/** Backend API base URL (categorization, receipt scan, anomaly detection). */
export const AI_API_URL =
  (import.meta.env.VITE_AI_API_URL as string) ?? "http://127.0.0.1:5001";
