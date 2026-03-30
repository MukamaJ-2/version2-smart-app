import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, Sparkles, TrendingUp, Target, Zap, BarChart3, Lightbulb } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { buildAiResponse, generateProactiveNudges, type CompanionGoal, type ProactiveNudge } from "@/lib/ai/companion";
import { aiService } from "@/lib/ai/ai-service";
import type { TrainingTransaction } from "@/lib/ai/training-data";
import type { SmartMoneyTransactionInput } from "@/lib/smart-money";
import SmartMoneyAgentPanel from "@/components/reports/SmartMoneyAgentPanel";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  suggestions?: string[];
  usedLLM?: boolean;
}

const quickActions = [
  { icon: TrendingUp, label: "Where did my money go?", query: "Summarize my spending this month in simple terms" },
  { icon: Target, label: "How are my goals?", query: "How are my savings goals doing and what should I do next?" },
  { icon: Zap, label: "Help with my budget", query: "Give me practical tips to stay within my budget" },
  { icon: BarChart3, label: "How am I doing?", query: "How am I doing with money overall right now?" },
];

const COMPANION_STORAGE_KEY = "uniguard.companion.messages";

interface GoalRow {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string;
  monthly_contribution: number;
}

export default function Companion() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(COMPANION_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as Array<Omit<Message, "timestamp"> & { timestamp: string }>;
      return parsed.map((msg) => ({ ...msg, timestamp: new Date(msg.timestamp) }));
    } catch (error) {
      console.error("Failed to load companion messages", error);
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [goals, setGoals] = useState<CompanionGoal[]>([]);
  const [nudges, setNudges] = useState<ProactiveNudge[]>([]);
  const [smartMoneyTransactions, setSmartMoneyTransactions] = useState<SmartMoneyTransactionInput[]>([]);

  useEffect(() => {
    let isActive = true;
    const loadData = async () => {
      if (!isSupabaseConfigured) {
        aiService.initialize([], 0);
        setSmartMoneyTransactions([]);
        return;
      }
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!isActive) return;
      if (userError || !userData.user) {
        aiService.initialize([], 0);
        setSmartMoneyTransactions([]);
        return;
      }
      const { data: txData, error: txError } = await supabase
        .from("transactions")
        .select("id,description,amount,category,type,date,time")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      const rows = txError ? [] : (txData ?? []);
      const transactions: TrainingTransaction[] = rows.map((r) => ({
        description: r.description,
        amount: r.amount,
        category: r.category,
        type: r.type,
        date: r.date,
      }));
      setSmartMoneyTransactions(rows as SmartMoneyTransactionInput[]);
      const incomeTotal = transactions
        .filter((tx) => tx.type === "income")
        .reduce((sum, tx) => sum + tx.amount, 0);
      aiService.initialize(transactions, incomeTotal);
      if (!isActive) return;
      setNudges(generateProactiveNudges());

      const { data: goalData, error: goalError } = await supabase
        .from("goals")
        .select("id,name,target_amount,current_amount,deadline,monthly_contribution")
        .eq("user_id", userData.user.id);
      if (!isActive) return;
      if (!goalError && goalData?.length) {
        setGoals(
          (goalData as GoalRow[]).map((row) => ({
            name: row.name,
            targetAmount: row.target_amount,
            currentAmount: row.current_amount,
            monthlyContribution: row.monthly_contribution,
            deadline: row.deadline,
          }))
        );
      } else {
        setGoals([]);
      }
    };
    loadData();
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload = messages.map((msg) => ({
        ...msg,
        timestamp: msg.timestamp.toISOString(),
      }));
      window.localStorage.setItem(COMPANION_STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error("Failed to save companion messages", error);
    }
  }, [messages]);

  const handleVoiceInput = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Voice input unavailable",
        description: "Your browser does not support speech recognition.",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setInput(transcript);
    };
    recognition.onerror = () => {
      toast({
        title: "Voice input failed",
        description: "Please try again or type your message.",
        variant: "destructive",
      });
    };
    recognition.start();
    toast({
      title: "Listening...",
      description: "Speak your question clearly.",
    });
  };

  const handleSend = () => {
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    const lastUserMessage = (() => {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      return lastUser?.content;
    })();

    // Small delay for typing UX, then call LLM (async)
    setTimeout(async () => {
      const aiResponse = await buildAiResponse(userMessage.content, {
        goals: goals.length > 0 ? goals : undefined,
        lastUserMessage,
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: aiResponse.content,
        timestamp: new Date(),
        suggestions: aiResponse.suggestions,
        usedLLM: aiResponse.usedLLM,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 600);
  };

  const handleQuickAction = (query: string) => {
    setInput(query);
    setTimeout(() => handleSend(), 100);
  };

  return (
    <AppLayout>
      <div className="min-h-screen p-4 sm:p-6 flex flex-col max-w-5xl mx-auto">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-secondary flex items-center justify-center shadow-glow-secondary">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                Money coach
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Chat below, or use Smart Money for structured totals and AI tips from your transactions
              </p>
            </div>
            <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-xl">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-sm font-mono text-foreground">Ready</span>
            </div>
          </div>
        </motion.header>

        {/* Starter questions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                onClick={() => handleQuickAction(action.query)}
                className="glass-card rounded-xl p-4 hover:glass-card-glow transition-all group text-left"
              >
                <div className="p-2 rounded-lg bg-primary/10 w-fit mb-2 group-hover:scale-110 transition-transform">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs font-medium text-foreground">{action.label}</p>
              </motion.button>
            );
          })}
        </motion.div>

        {/* Smart Money (same data as chat context) */}
        {smartMoneyTransactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mb-6"
          >
            <SmartMoneyAgentPanel transactions={smartMoneyTransactions} />
          </motion.div>
        )}

        {/* Proactive Nudges */}
        {nudges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2 mb-6"
          >
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-[0.1em] flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" />
              AI-Powered Insights
            </p>
            {nudges.map((nudge) => (
              <motion.div
                key={nudge.id}
                whileHover={{ x: 4 }}
                className={cn(
                  "glass-card rounded-xl p-3 border cursor-pointer transition-all",
                  nudge.type === "warning" && "border-warning/30 bg-warning/5 hover:bg-warning/10",
                  nudge.type === "positive" && "border-success/30 bg-success/5 hover:bg-success/10",
                  nudge.type === "info" && "border-primary/30 bg-primary/5 hover:bg-primary/10"
                )}
                onClick={() => handleQuickAction(nudge.action)}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-1.5 rounded-lg shrink-0 mt-0.5",
                    nudge.type === "warning" && "bg-warning/20",
                    nudge.type === "positive" && "bg-success/20",
                    nudge.type === "info" && "bg-primary/20"
                  )}>
                    {nudge.type === "warning" && <Zap className="w-3.5 h-3.5 text-warning" />}
                    {nudge.type === "positive" && <TrendingUp className="w-3.5 h-3.5 text-success" />}
                    {nudge.type === "info" && <Lightbulb className="w-3.5 h-3.5 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-foreground leading-relaxed">{nudge.message}</p>
                    <p className="text-xs font-bold text-primary mt-1 uppercase tracking-wider">{nudge.action} &rarr;</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Chat Area */}
        <div className="flex-1 glass-card rounded-2xl overflow-hidden flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
            <AnimatePresence>
              {messages.length === 0 && !isTyping && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground"
                >
                  Start a conversation to see responses here.
                </motion.div>
              )}
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "flex",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                      message.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/50 text-foreground rounded-bl-md"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-medium text-primary">Money coach</span>
                      </div>
                    )}
                    <p className="whitespace-pre-line">{message.content}</p>
                    {message.suggestions && message.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {message.suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleQuickAction(suggestion)}
                            className="px-3 py-1.5 text-xs rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-muted/50 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0s" }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.2s" }} />
                      <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0.4s" }} />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-2 glass-card rounded-xl px-4 py-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Ask me anything about your finances..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                disabled={isTyping}
              />
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground h-8 w-8"
                disabled={isTyping}
                onClick={handleVoiceInput}
              >
                <Mic className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="h-8 w-8 rounded-lg bg-gradient-primary hover:opacity-90 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              <Lightbulb className="w-3 h-3 inline mr-1" />
              Try: "How can I save more?" or "Analyze my spending"
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

