import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Fix HMR disconnects in the preview (HTTPS behind proxy). Without this,
    // the client can end up polling `https://<host>:/` and reloading when focus returns.
    hmr: {
      overlay: true,
      // Preview runs on HTTPS; HMR websocket must use wss and the external port.
      protocol: "wss",
      clientPort: 443,
    },
    watch: {
      // Don't trigger reload when switching windows
      usePolling: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Optimize dependency pre-bundling to reduce HMR triggers
  optimizeDeps: {
    exclude: [],
  },
}));
