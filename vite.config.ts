import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Disable HMR full reload on window focus to prevent refresh on tab switch
    hmr: {
      overlay: true,
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
