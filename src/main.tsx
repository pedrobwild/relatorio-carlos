import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/errorMonitoring";
import { registerOfflineCacheSW } from "./lib/registerSW";

// Initialize error monitoring before rendering
initErrorMonitoring();

// Register offline cache service worker (production only, never in preview/iframe)
registerOfflineCacheSW();

createRoot(document.getElementById("root")!).render(<App />);
