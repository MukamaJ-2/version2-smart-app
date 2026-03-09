import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Index from "./pages/index";
import Transactions from "./pages/Transactions";
import BudgetPorts from "./pages/BudgetPorts";
import Goals from "./pages/Goals";
import Companion from "./pages/Companion";
import Reports from "./pages/Reports";
import Achievements from "./pages/Achievements";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import OnboardingSurvey from "./pages/OnboardingSurvey";
import RequireOnboarding from "./components/auth/RequireOnboarding";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth />} />
          <Route path="/onboarding" element={<OnboardingSurvey />} />
          <Route path="/dashboard" element={<RequireOnboarding><Index /></RequireOnboarding>} />
          <Route path="/transactions" element={<RequireOnboarding><Transactions /></RequireOnboarding>} />
          <Route path="/budget-ports" element={<RequireOnboarding><BudgetPorts /></RequireOnboarding>} />
          <Route path="/goals" element={<RequireOnboarding><Goals /></RequireOnboarding>} />
          <Route path="/companion" element={<RequireOnboarding><Companion /></RequireOnboarding>} />
          <Route path="/reports" element={<RequireOnboarding><Reports /></RequireOnboarding>} />
          <Route path="/achievements" element={<RequireOnboarding><Achievements /></RequireOnboarding>} />
          <Route path="/settings" element={<RequireOnboarding><Settings /></RequireOnboarding>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
