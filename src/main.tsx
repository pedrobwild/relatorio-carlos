import { createRoot } from "react-dom/client";
import * as amplitude from "@amplitude/unified";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/errorMonitoring";
import { registerOfflineCacheSW } from "./lib/registerSW";

// Initialize error monitoring before rendering
initErrorMonitoring();

// Register offline cache service worker (production only, never in preview/iframe)
registerOfflineCacheSW();

// Initialize Amplitude Analytics + Session Replay (client-side only)
const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY;
if (typeof window !== "undefined" && AMPLITUDE_API_KEY) {
  amplitude.initAll(AMPLITUDE_API_KEY, {
    analytics: {
      autocapture: true,
    },
    sessionReplay: {
      sampleRate: 1,
    },
  });
} else if (typeof window !== "undefined" && import.meta.env.DEV) {
  console.warn(
    "[Amplitude] VITE_AMPLITUDE_API_KEY não configurada — analytics desativado."
  );
}

createRoot(document.getElementById("root")!).render(<App />);
