import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Clamp a percentage to 0–100 for display (e.g. progress, savings rate, budget used).
 */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Clamp a change percentage for display (e.g. "+15%" vs last month).
 * Keeps sign but caps at ±999 to avoid extreme values.
 */
export function clampChangePercent(value: number): number {
  return Math.min(999, Math.max(-999, value));
}

/**
 * Format a 0–100 percentage for display.
 */
export function formatPercent(value: number, decimals = 0): string {
  return `${Math.round(clampPercent(value) * Math.pow(10, decimals)) / Math.pow(10, decimals)}%`;
}

/**
 * Format a change percentage (can be negative) for display.
 */
export function formatChangePercent(value: number, decimals = 0): string {
  const clamped = clampChangePercent(value);
  const formatted = (Math.round(clamped * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals);
  return `${clamped >= 0 ? "+" : ""}${formatted}%`;
}
