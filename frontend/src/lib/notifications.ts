export type NotificationType = "anomaly" | "budget_over";

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
}

const NOTIFICATIONS_KEY_PREFIX = "uniguard.notifications.";
const NOTIFIED_EMAIL_KEY_PREFIX = "uniguard.notifications.sent.";
const USER_EMAIL_KEY = "uniguard.user.email";

export function getUserEmail(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(USER_EMAIL_KEY);
}

export function setUserEmail(email: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(USER_EMAIL_KEY, email);
}

function notificationsKey(userId: string | null): string | null {
  if (typeof window === "undefined" || !userId) return null;
  return `${NOTIFICATIONS_KEY_PREFIX}${userId}`;
}

function sentKey(userId: string | null): string | null {
  if (typeof window === "undefined" || !userId) return null;
  return `${NOTIFIED_EMAIL_KEY_PREFIX}${userId}`;
}

/**
 * Get notifications for the current user only. Pass userId so each user sees only their own.
 */
export function getNotifications(userId: string | null): AppNotification[] {
  if (typeof window === "undefined") return [];
  const key = notificationsKey(userId);
  if (!key) return [];
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as AppNotification[];
  } catch {
    return [];
  }
}

const NOTIFICATIONS_UPDATED_EVENT = "uniguard.notifications.updated";

/**
 * Add or update a notification for the current user. If id exists, updates that item and moves to front.
 */
export function addNotification(notification: AppNotification, userId: string | null) {
  if (typeof window === "undefined") return;
  const key = notificationsKey(userId);
  if (!key) return;
  const existing = getNotifications(userId);
  const idx = existing.findIndex((item) => item.id === notification.id);
  const updated =
    idx >= 0
      ? [notification, ...existing.slice(0, idx), ...existing.slice(idx + 1)]
      : [notification, ...existing];
  window.localStorage.setItem(key, JSON.stringify(updated.slice(0, 100)));
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail: { userId } }));
}

/** Subscribe to notification updates (e.g. when added from same tab). */
export function onNotificationsUpdated(callback: (userId: string | null) => void) {
  const handler = (e: Event) => callback((e as CustomEvent).detail?.userId ?? null);
  window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handler);
}

export function wasEmailSent(notificationId: string, userId: string | null): boolean {
  if (typeof window === "undefined") return false;
  const key = sentKey(userId);
  if (!key) return false;
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;
  try {
    const sent = JSON.parse(raw) as string[];
    return sent.includes(notificationId);
  } catch {
    return false;
  }
}

export function markEmailSent(notificationId: string, userId: string | null) {
  if (typeof window === "undefined") return;
  const key = sentKey(userId);
  if (!key) return;
  const raw = window.localStorage.getItem(key);
  const sent = raw ? (JSON.parse(raw) as string[]) : [];
  if (!sent.includes(notificationId)) {
    sent.push(notificationId);
    window.localStorage.setItem(key, JSON.stringify(sent.slice(-200)));
  }
}
