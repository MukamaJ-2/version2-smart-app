import { ReactNode } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import AICompanionPanel from "@/components/ai/AICompanionPanel";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background min-w-0">
      <Sidebar />
      <main className="flex-1 overflow-x-hidden overflow-y-auto pb-16 md:pb-0 min-w-0">
        {children}
      </main>
      <AICompanionPanel />
      <BottomNav />
    </div>
  );
}
