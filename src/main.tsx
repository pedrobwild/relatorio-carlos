// PRIMEIRO import: corrige a URL do link de recuperação de senha antes de o
// cliente do Supabase (importado por App) ler e limpar o hash.
import "./lib/passwordRecoveryRedirect";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initErrorMonitoring } from "./lib/errorMonitoring";
import { registerOfflineCacheSW } from "./lib/registerSW";
import { bootstrapAmplitudeConsent } from "./lib/amplitude";
import { installChunkReloadHandler } from "./lib/chunkReload";
import { installSessionRecovery } from "./lib/authRecovery";
import { installPasswordRecoveryListener } from "./lib/passwordRecoveryListener";

// Install stale-chunk auto-recovery BEFORE anything else so we catch early
// dynamic-import failures (post-deploy). Guarded internally against loops.
installChunkReloadHandler();

// Initialize error monitoring before rendering
initErrorMonitoring();

// Renova o token quando a aba volta do segundo plano. Sem isto, uma aba que
// ficou horas suspensa (celular, PWA) volta com o access token vencido e todo
// request responde 401 — o app parece logado mas não carrega nada.
installSessionRecovery();

// Leva para /redefinir-senha quando o Supabase sinaliza PASSWORD_RECOVERY
// fora dessa tela (ex.: Site URL usada no lugar do redirectTo).
installPasswordRecoveryListener();

// Register offline cache service worker (production only, never in preview/iframe)
registerOfflineCacheSW();

// Amplitude só inicializa se houver consentimento prévio salvo;
// caso contrário, aguarda o usuário interagir com o ConsentBanner.
bootstrapAmplitudeConsent();

createRoot(document.getElementById("root")!).render(<App />);
