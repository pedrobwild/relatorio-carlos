/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_SUPABASE_PROJECT_ID?: string;
  readonly VITE_DEMO_MODE?: string;
  // Build info (injected at build time)
  readonly VITE_GIT_COMMIT?: string;
  readonly VITE_GIT_BRANCH?: string;
  readonly VITE_BUILD_DATE?: string;
  readonly VITE_APP_VERSION?: string;
  // Error monitoring
  readonly VITE_SENTRY_PROJECT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
