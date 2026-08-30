import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/errorMonitoring";
import { registerOfflineCacheSW } from "./lib/registerSW";
import { bootstrapAmplitudeConsent } from "./lib/amplitude";
import { installChunkReloadHandler } from "./lib/chunkReload";
import { installSessionRecovery } from "./lib/authRecovery";

// Install stale-chunk auto-recovery BEFORE anything else so we catch early
// dynamic-import failures (post-deploy). Guarded internally against loops.
installChunkReloadHandler();

// Initialize error monitoring before rendering
initErrorMonitoring();

// Renova o token quando a aba volta do segundo plano. Sem isto, uma aba que
// ficou horas suspensa (celular, PWA) volta com o access token vencido e todo
// request responde 401 — o app parece logado mas não carrega nada.
installSessionRecovery();

// Register offline cache service worker (production only, never in preview/iframe)
registerOfflineCacheSW();

// Amplitude só inicializa se houver consentimento prévio salvo;
// caso contrário, aguarda o usuário interagir com o ConsentBanner.
bootstrapAmplitudeConsent();

createRoot(document.getElementById("root")!).render(<App />);
