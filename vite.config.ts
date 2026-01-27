import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // NOTE: In some browser/proxy combinations, the Vite HMR websocket is closed
    // when the tab is backgrounded. Vite then forces a full page reload when the
    // tab becomes visible again.
    // Disabling HMR prevents the "refresh when switching tabs" behavior in Preview.
    hmr: false,
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
