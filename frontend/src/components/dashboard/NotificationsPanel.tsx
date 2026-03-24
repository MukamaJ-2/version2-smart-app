import { motion } from "framer-motion";
import { Bell, AlertTriangle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getNotifications, onNotificationsUpdated, type AppNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabase";

export default function NotificationsPanel() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const refresh = useMemo(
    () => () => setNotifications(getNotifications(userId)),
    [userId]
  );

  useEffect(() => {
    let isActive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isActive) return;
      setUserId(user?.id ?? null);
    })();
    return () => { isActive = false; };
  }, []);

  useEffect(() => {
    refresh();
    const storageHandler = () => refresh();
    window.addEventListener("storage", storageHandler);
    const unsub = onNotificationsUpdated((uid) => {
      if (uid === userId) refresh();
    });
    return () => {
      window.removeEventListener("storage", storageHandler);
      unsub();
    };
  }, [userId, refresh]);

  const recent = useMemo(() => notifications.slice(0, 4), [notifications]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="glass-card rounded-2xl p-5 border border-border/60 shadow-lg shadow-primary/5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Bell className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-foreground tracking-tight">Notifications</h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Alerts & updates</p>
          </div>
        </div>
        <Link
          to="/transactions"
          className="text-xs font-medium text-primary hover:text-primary-glow transition-colors"
        >
          View →
        </Link>
      </div>

      <div className="space-y-2">
        {recent.length === 0 && (
          <div className="text-xs text-muted-foreground">
            No notifications yet.
          </div>
        )}
        {recent.map((note) => (
          <Link
            key={note.id}
            to={note.type === "budget_over" ? "/budget-ports" : "/transactions"}
            className="block rounded-xl border border-border/60 p-3 text-xs text-muted-foreground hover:border-primary/30 hover:bg-muted/20 transition-all"
          >
            <div className="flex items-start gap-2">
              {note.type === "budget_over" && (
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-foreground font-medium">{note.title}</p>
                <p className="mt-1">{note.message}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString("en-UG")}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
