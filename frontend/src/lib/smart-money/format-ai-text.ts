/**
 * Strip common markdown so UI shows plain text (model often still emits **bold**).
 */
export function plainTextFromAiAdvice(raw: string): string {
  let t = raw.trim();
  // Bold / italic markers
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*\n]+)\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\*\*/g, "");
  t = t.replace(/(?<!\*)\*(?!\*)/g, "");
  // Markdown headings
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t.trim();
}
