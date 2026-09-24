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
  build: {
    // Sobe o limite de aviso (chunks grandes esperados são lazy/vendor splits).
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Estratégia de manualChunks: extrai dependências pesadas em vendor
        // chunks separados para que o entry inicial fique enxuto e o cache
        // do navegador funcione melhor (vendors mudam muito menos que app code).
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          // Bibliotecas pesadas usadas APENAS em rotas específicas —
          // não devem entrar no entry. Como são lazy via rota, ficam
          // em chunks dedicados que só carregam quando necessário.
          // Toda a stack de export PDF (html2pdf + html2canvas + canvg + svg helpers).
          if (
            id.includes("html2pdf.js") ||
            id.includes("jspdf") ||
            id.includes("html2canvas") ||
            id.includes("canvg") ||
            id.includes("stackblur-canvas") ||
            id.includes("rgbcolor") ||
            id.includes("svg-pathdata") ||
            id.includes("raf") ||
            id.includes("performance-now")
          ) return "vendor-pdf-export";
          if (id.includes("react-pdf") || id.includes("pdfjs-dist")) return "vendor-pdf-viewer";
          if (
            id.includes("recharts") ||
            id.includes("d3-") ||
            id.includes("victory-vendor") ||
            id.includes("react-smooth") ||
            id.includes("decimal.js-light") ||
            id.includes("internmap") ||
            id.includes("fast-equals")
          ) return "vendor-charts";
          if (
            id.includes("framer-motion") ||
            id.includes("motion-dom") ||
            id.includes("motion-utils")
          ) return "vendor-motion";
          if (id.includes("embla-carousel")) return "vendor-carousel";
          if (id.includes("react-day-picker") || id.includes("date-fns")) return "vendor-date";
          if (id.includes("papaparse")) return "vendor-csv";
          if (id.includes("/xlsx/")) return "vendor-xlsx";
          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("micromark") ||
            id.includes("mdast-") ||
            id.includes("unist-") ||
            id.includes("hast-") ||
            id.includes("unified") ||
            id.includes("vfile") ||
            id.includes("property-information") ||
            id.includes("html-url-attributes") ||
            id.includes("comma-separated-tokens") ||
            id.includes("space-separated-tokens") ||
            id.includes("decode-named-character-reference") ||
            id.includes("inline-style-parser") ||
            id.includes("style-to-js") ||
            id.includes("style-to-object") ||
            id.includes("trim-lines") ||
            id.includes("trough") ||
            id.includes("bail") ||
            id.includes("is-plain-obj") ||
            id.includes("estree-util-is-identifier-name") ||
            id.includes("devlop") ||
            id.includes("extend")
          ) return "vendor-markdown";
          if (id.includes("dompurify")) return "vendor-sanitize";
          if (id.includes("jsdom") || id.includes("vitest")) return "vendor-test"; // não deveria entrar em prod, mas isola se entrar

          // Vendors core compartilhados — podem ficar no entry, mas separar
          // melhora o cache (mudam pouco entre deploys).
          // "vendor-ui": Radix + libs auxiliares (Floating UI, scroll lock, vaul, cmdk, sonner)
          if (
            id.includes("@radix-ui") ||
            id.includes("@floating-ui") ||
            id.includes("react-remove-scroll") ||
            id.includes("react-style-singleton") ||
            id.includes("use-callback-ref") ||
            id.includes("use-sidecar") ||
            id.includes("use-sync-external-store") ||
            id.includes("aria-hidden") ||
            id.includes("get-nonce") ||
            id.includes("vaul") ||
            id.includes("cmdk") ||
            id.includes("sonner") ||
            id.includes("next-themes") ||
            id.includes("input-otp") ||
            id.includes("react-resizable-panels")
          ) return "vendor-ui";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (
            id.includes("@supabase") ||
            id.includes("@tanstack") ||
            id.includes("react-router") ||
            id.includes("react-hook-form") ||
            id.includes("@hookform") ||
            id.includes("zod")
          ) return "vendor-app";
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) return "vendor-react";

          return "vendor-misc";
        },
      },
    },
  },
}));
