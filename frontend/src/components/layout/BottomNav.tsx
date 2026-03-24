import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Menu, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { bottomNavShortLabel } from "@/lib/feature-labels";
import { bottomNavItems, moreSheetNavItems } from "./navConfig";

const BOTTOM_NAV_HEIGHT = 64;

export const BOTTOM_NAV_HEIGHT_CLASS = "pb-[64px]";
export { BOTTOM_NAV_HEIGHT };

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleLogout = async () => {
    setMoreOpen(false);
    try {
      sessionStorage.removeItem("onboarding_completed");
      sessionStorage.removeItem("onboarding_just_completed");
    } catch {}
    await supabase.auth.signOut();
    toast({ title: "Logged out", description: "You have been successfully logged out." });
    setTimeout(() => navigate("/auth"), 500);
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-14 min-h-[56px] items-center justify-around border-t border-sidebar-border bg-sidebar/95 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
      >
        {bottomNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] touch-manipulation active:opacity-80">
              <item.icon
                className={cn("h-6 w-6 shrink-0", isActive ? "text-primary" : "text-muted-foreground")}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={cn("text-[10px]", isActive ? "font-medium text-primary" : "text-muted-foreground")}>
                {bottomNavShortLabel(item.label)}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[44px] touch-manipulation active:opacity-80",
            location.pathname !== "/dashboard" && moreSheetNavItems.some((i) => i.path === location.pathname)
              ? "text-primary"
              : "text-muted-foreground"
          )}
        >
          <Menu className="h-6 w-6 shrink-0" />
          <span className="text-[10px]">More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t pb-safe max-h-[85vh] overflow-y-auto"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-1">
            {moreSheetNavItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setMoreOpen(false)}>
                  <motion.div
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3",
                      isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-sidebar-accent"
                    )}
                    whileTap={{ scale: 0.98 }}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </motion.div>
                </Link>
              );
            })}
            <div className="my-2 border-t border-border pt-2">
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-3 h-5 w-5" />
                Logout
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
