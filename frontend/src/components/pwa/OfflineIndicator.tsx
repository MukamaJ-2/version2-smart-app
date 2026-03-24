import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * OfflineIndicator  — shows a banner when the browser goes offline
 * and a "update ready" prompt when a new SW is available.
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [justCameBack, setJustCameBack] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.info("[SW] registered", r);
    },
    onRegisterError(err) {
      console.warn("[SW] registration failed", err);
    },
  });

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setJustCameBack(true);
      setTimeout(() => setJustCameBack(false), 3000);
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {/* Offline banner */}
      {!isOnline && (
        <motion.div
          key="offline"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-destructive/95 text-destructive-foreground text-sm py-2 px-4 backdrop-blur-sm"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>You're offline — showing cached data</span>
        </motion.div>
      )}

      {/* Back online flash */}
      {justCameBack && isOnline && (
        <motion.div
          key="back-online"
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-2 bg-success/90 text-white text-sm py-2 px-4 backdrop-blur-sm"
        >
          <Wifi className="w-4 h-4 shrink-0" />
          <span>Back online!</span>
        </motion.div>
      )}

      {/* SW update available */}
      {needRefresh && (
        <motion.div
          key="update"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 glass-card border border-primary/40 rounded-full py-2.5 px-5 shadow-xl"
        >
          <RefreshCw className="w-4 h-4 text-primary animate-spin" style={{ animationDuration: "2s" }} />
          <span className="text-sm text-foreground">New version available</span>
          <button
            onClick={() => updateServiceWorker(true)}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Update
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
