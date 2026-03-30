import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate, Link, useLocation } from "react-router-dom";
import {
  Wallet,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Shield,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { setUserEmail } from "@/lib/notifications";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isValidEmail, normalizeEmail } from "@/lib/auth/email";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const emailCallbackHandled = useRef(false);
  const authHashErrorHandled = useRef(false);

  // Supabase puts #error=…&error_code=otp_expired&error_description=… when the email link expired or was already used
  useEffect(() => {
    if (typeof window === "undefined" || authHashErrorHandled.current) return;
    const raw = window.location.hash;
    if (!raw || !raw.includes("error=")) return;

    authHashErrorHandled.current = true;
    const qs = raw.startsWith("#") ? raw.slice(1) : raw;
    const params = new URLSearchParams(qs);
    const errCode = params.get("error_code");
    const descRaw = params.get("error_description");
    const description = descRaw
      ? decodeURIComponent(descRaw.replace(/\+/g, " "))
      : (params.get("error") ?? "Something went wrong.");

    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    const isExpired = errCode === "otp_expired" || description.toLowerCase().includes("expired");
    toast({
      title: isExpired ? "Confirmation link expired" : "Email link didn’t work",
      description: isExpired
        ? "Open Supabase → Authentication → Users and resend confirmation, or try signing up again with the same email. Use the new link within a few minutes."
        : description,
      variant: "destructive",
    });
    setIsLogin(true);
  }, []);

  // Set initial tab based on route
  useEffect(() => {
    if (location.pathname === "/register") {
      setIsLogin(false);
    } else {
      setIsLogin(true);
    }
  }, [location.pathname]);

  // Email confirmation / magic-link: Supabase redirects with #access_token=… or ?code=…
  useEffect(() => {
    if (!isSupabaseConfigured || emailCallbackHandled.current) return;

    const hasImplicitHash =
      typeof window !== "undefined" &&
      (window.location.hash.includes("access_token") || window.location.hash.includes("type="));
    const hasPkceCode =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).has("code");

    if (!hasImplicitHash && !hasPkceCode) return;

    let cancelled = false;

    (async () => {
      try {
        if (hasPkceCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error || cancelled) return;
        }

        let session = (await supabase.auth.getSession()).data.session;
        if (!session?.user && hasImplicitHash) {
          for (let i = 0; i < 8 && !cancelled; i++) {
            await new Promise((r) => setTimeout(r, 80));
            session = (await supabase.auth.getSession()).data.session;
            if (session?.user) break;
          }
        }
        if (cancelled || !session?.user) return;

        emailCallbackHandled.current = true;
        window.history.replaceState(null, "", window.location.pathname + window.location.search);

        const uid = session.user.id;
        const { data: profileData } = await supabase
          .from("profiles")
          .select("onboarding_completed_at")
          .eq("id", uid)
          .maybeSingle();

        const completed = !!profileData?.onboarding_completed_at;
        toast({
          title: "Email confirmed",
          description: completed ? "Welcome back." : "You're signed in — let's finish setup.",
        });
        navigate(completed ? "/dashboard" : "/onboarding", { replace: true });
      } catch (e) {
        console.error("Auth callback:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSupabaseConfigured, navigate]);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  
  // Register form
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState("");
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    if (!isSupabaseConfigured) {
      toast({
        title: "Login not available",
        description: "This deployment does not have Supabase configured. Ask the administrator to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment (e.g. Railway Variables) and redeploy.",
        variant: "destructive",
      });
      return;
    }
    if (!isValidEmail(loginEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid, working email address.",
        variant: "destructive",
      });
      return;
    }

    const normalizedEmail = normalizeEmail(loginEmail);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: loginPassword,
    });
    if (error || !data.user) {
      toast({
        title: "Login failed",
        description: error?.message ?? "Email or password is incorrect.",
        variant: "destructive",
      });
      return;
    }

    let displayName = "Welcome back!";
    const { data: profileData } = await supabase
      .from("profiles")
      .select("name, onboarding_completed_at")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileData?.name) {
      displayName = `Welcome back, ${profileData.name}.`;
    }
    toast({
      title: "Welcome back!",
      description: displayName,
    });
    setUserEmail(data.user.email ?? normalizedEmail);

    // Survey only for accounts that haven't completed it; returning users go straight to dashboard
    const completedOnboarding = !!profileData?.onboarding_completed_at;
    if (completedOnboarding && typeof window !== "undefined") {
      try {
        sessionStorage.setItem("onboarding_completed", "1");
      } catch {}
    }
    const nextPath = completedOnboarding ? "/dashboard" : "/onboarding";
    setTimeout(() => {
      navigate(nextPath);
    }, 500);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName || !registerEmail || !registerPassword || !registerConfirmPassword) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      toast({
        title: "Password mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (!isValidEmail(registerEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid, working email address.",
        variant: "destructive",
      });
      return;
    }

    if (!isSupabaseConfigured) {
      toast({
        title: "Sign up not available",
        description: "This deployment does not have Supabase configured. Ask the administrator to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment environment (e.g. Railway Variables) and redeploy.",
        variant: "destructive",
      });
      return;
    }

    if (registerPassword.length < 8) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    if (!agreeToTerms) {
      toast({
        title: "Terms required",
        description: "Please agree to the terms and conditions.",
        variant: "destructive",
      });
      return;
    }

    const normalizedEmail = normalizeEmail(registerEmail);
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: registerPassword,
      options: redirectTo
        ? {
            emailRedirectTo: redirectTo,
          }
        : undefined,
    });
    if (error) {
      const msg = error.message.toLowerCase();
      const isRateLimit =
        msg.includes("rate limit") || msg.includes("too many") || msg.includes("email rate");
      toast({
        title: isRateLimit ? "Too many emails sent" : "Registration failed",
        description: isRateLimit
          ? "Supabase limits how many confirmation emails can be sent per hour. Wait a bit, try again later, or add custom SMTP in Supabase → Authentication → SMTP."
          : error.message,
        variant: "destructive",
      });
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      await supabase.from("profiles").upsert(
        {
          id: userId,
          name: registerName.trim(),
          email: normalizedEmail,
          phone: "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    setUserEmail(normalizedEmail);
    if (data.session) {
      toast({
        title: "Account created!",
        description: "Welcome to UniGuard Wallet. Complete a short survey to personalize your experience.",
      });
      setTimeout(() => {
        navigate("/onboarding");
      }, 500);
    } else {
      toast({
        title: "Confirm your email",
        description: "Check your inbox to verify your email before signing in.",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(-12deg, transparent, transparent 52px, hsl(var(--border) / 0.45) 52px, hsl(var(--border) / 0.45) 53px)",
        }}
      />
      <div className="absolute inset-0 grid-pattern opacity-[0.12] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo and Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-xl border-2 border-primary/70 bg-card shadow-md mb-4">
            <Wallet className="w-9 h-9 text-primary" strokeWidth={1.75} />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">
            UniGuard Wallet
          </h1>
          <p className="text-muted-foreground text-sm">
            Your money, organized and private
          </p>
        </motion.div>

        {!isSupabaseConfigured && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Login not configured</AlertTitle>
            <AlertDescription>
              This deployment does not have Supabase set up. To enable sign in and sign up, add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment environment (e.g. Railway → Variables), then redeploy.
            </AlertDescription>
          </Alert>
        )}

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-xl p-8 border border-border relative overflow-hidden shadow-card"
        >
          <Tabs value={isLogin ? "login" : "register"} onValueChange={(v) => setIsLogin(v === "login")} className="w-full">
            <TabsList className="glass-card mb-6 w-full rounded-md p-1">
              <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
              <TabsTrigger value="register" className="flex-1">Sign Up</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login" className="space-y-4 mt-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email" className="text-sm font-medium text-foreground mb-2 block">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-email"
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10 bg-muted/30 border-border focus:border-primary/50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="login-password" className="text-sm font-medium text-foreground mb-2 block">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="pl-10 pr-10 bg-muted/30 border-border focus:border-primary/50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                      Remember me
                    </Label>
                  </div>
                  <Link
                    to="/forgot-password"
                    className="text-sm text-primary hover:underline underline-offset-4 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>

                <Button type="submit" className="w-full h-11 text-base font-semibold" variant="glow">
                  Sign In
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>

              {/* Social Login Options */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" className="border-border hover:border-primary/50 hover:bg-primary/5">
                  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </Button>
                <Button variant="outline" className="border-border hover:border-primary/50 hover:bg-primary/5">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub
                </Button>
              </div>
            </TabsContent>

            {/* Register Tab */}
            <TabsContent value="register" className="space-y-4 mt-0">
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <Label htmlFor="register-name" className="text-sm font-medium text-foreground mb-2 block">
                    Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="register-name"
                      type="text"
                      value={registerName}
                      onChange={(e) => setRegisterName(e.target.value)}
                      placeholder="John Doe"
                      className="pl-10 bg-muted/30 border-border focus:border-primary/50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-email" className="text-sm font-medium text-foreground mb-2 block">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="register-email"
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="pl-10 bg-muted/30 border-border focus:border-primary/50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-password" className="text-sm font-medium text-foreground mb-2 block">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="pl-10 pr-10 bg-muted/30 border-border focus:border-primary/50"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="register-confirm" className="text-sm font-medium text-foreground mb-2 block">
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="register-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      value={registerConfirmPassword}
                      onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                      placeholder="Confirm your password"
                      className="pl-10 pr-10 bg-muted/30 border-border focus:border-primary/50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={agreeToTerms}
                    onCheckedChange={(checked) => setAgreeToTerms(checked as boolean)}
                    className="mt-1"
                  />
                  <Label htmlFor="terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
                    I agree to the{" "}
                    <Link to="/terms" className="text-primary hover:underline underline-offset-2">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="text-primary hover:underline underline-offset-2">
                      Privacy Policy
                    </Link>
                  </Label>
                </div>

                <Button type="submit" className="w-full h-11 text-base font-semibold" variant="glow">
                  Create Account
                  <Sparkles className="w-4 h-4 ml-2" />
                </Button>
              </form>

              {/* Security Features */}
              <div className="mt-6 p-4 glass-card rounded-md border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Security Features</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3 h-3 text-success" />
                    <span>End-to-end encryption</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3 h-3 text-success" />
                    <span>Two-factor authentication</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle className="w-3 h-3 text-success" />
                    <span>Bank-level security</span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6 text-sm text-muted-foreground"
        >
          <p>
            By continuing, you agree to UniGuard Wallet's{" "}
            <Link to="/terms" className="text-primary hover:underline underline-offset-2">
              Terms
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary hover:underline underline-offset-2">
              Privacy Policy
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

