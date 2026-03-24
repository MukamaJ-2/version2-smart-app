import { ThemeProvider } from "next-themes";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { OfflineIndicator } from "./components/pwa/OfflineIndicator.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <OfflineIndicator />
    <App />
  </ThemeProvider>
);
