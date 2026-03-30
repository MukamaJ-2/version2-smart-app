/** Backend API base URL (categorization, receipt scan, anomaly detection). */

function resolveAiBase(): string {
  const raw = import.meta.env.VITE_AI_API_URL;
  if (typeof raw === "string" && raw.trim() !== "") {
    return raw.trim().replace(/\/$/, "");
  }
  // Never bake localhost into production bundles — set VITE_AI_API_URL at build (e.g. Railway).
  // Default matches backend/app.py PORT default (5000). Use PORT=5001 + VITE_AI_API_URL=http://127.0.0.1:5001 if needed.
  if (import.meta.env.DEV) {
    return "http://127.0.0.1:5000";
  }
  return "";
}

export const AI_API_URL = resolveAiBase();

export const isAiApiConfigured = AI_API_URL.length > 0;

/**
 * Fetch against the AI backend. Throws a clear error if VITE_AI_API_URL was not set at build time.
 */
export async function aiFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!AI_API_URL) {
    throw new Error(
      "AI backend URL is not configured. Set VITE_AI_API_URL to your deployed API base URL (https://…up.railway.app) in Railway Variables with build-time enabled, then redeploy the frontend."
    );
  }
  const p = path.startsWith("/") ? path : `/${path}`;
  return fetch(`${AI_API_URL}${p}`, init);
}
