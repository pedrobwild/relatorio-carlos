import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/errorMonitoring";
import { registerOfflineCacheSW } from "./lib/registerSW";
import { bootstrapAmplitudeConsent } from "./lib/amplitude";

// Initialize error monitoring before rendering
initErrorMonitoring();

// Register offline cache service worker (production only, never in preview/iframe)
registerOfflineCacheSW();

// Amplitude só inicializa se houver consentimento prévio salvo;
// caso contrário, aguarda o usuário interagir com o ConsentBanner.
bootstrapAmplitudeConsent();

createRoot(document.getElementById("root")!).render(<App />);
