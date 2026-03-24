import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, AlertTriangle, ArrowLeft } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AppLayout>
      <div className="min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-2xl"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="mb-8 flex justify-center"
          >
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-16 h-16 text-destructive" />
              </div>
              <motion.div
                className="absolute inset-0 rounded-full border-4 border-destructive/30"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="font-display text-6xl font-bold text-foreground mb-4"
          >
            404
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-semibold text-foreground mb-2"
          >
            Page Not Found
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-muted-foreground mb-8"
          >
            The page you're looking for doesn't exist or has been moved.
            <br />
            <span className="font-mono text-xs mt-2 block opacity-75">
              {location.pathname}
            </span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-4"
          >
            <Button
              asChild
              className="bg-gradient-primary hover:opacity-90"
            >
              <Link to="/dashboard">
                <Home className="w-4 h-4 mr-2" />
                Return Home
              </Link>
            </Button>
            <Button
              variant="outline"
              className="border-border hover:border-primary/50"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-12 glass-card rounded-xl p-6"
          >
            <p className="text-sm text-muted-foreground mb-4">
              Useful links
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/dashboard" className="text-xs text-primary hover:text-primary-glow transition-colors">
                Home
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/transactions" className="text-xs text-primary hover:text-primary-glow transition-colors">
                Transactions
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/budget-ports" className="text-xs text-primary hover:text-primary-glow transition-colors">
                Budgets
              </Link>
              <span className="text-muted-foreground">•</span>
              <Link to="/goals" className="text-xs text-primary hover:text-primary-glow transition-colors">
                Goals
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
};

export default NotFound;
