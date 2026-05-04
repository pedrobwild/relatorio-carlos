import { z } from "zod";

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().min(1, "Supabase URL is required"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "Supabase key is required"),
  VITE_SUPABASE_PROJECT_ID: z.string().optional(),
  VITE_DEMO_MODE: z.string().optional().default("false"),
});

function validateEnv() {
  const rawEnv = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env
      .VITE_SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    VITE_DEMO_MODE: import.meta.env.VITE_DEMO_MODE,
  };

  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const missingVars = result.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");

    throw new Error(
      `Missing or invalid environment configuration. Please check your .env file. Missing: ${missingVars}`,
    );
  }

  return {
    supabaseUrl: result.data.VITE_SUPABASE_URL,
    supabaseKey: result.data.VITE_SUPABASE_PUBLISHABLE_KEY,
    supabaseProjectId: result.data.VITE_SUPABASE_PROJECT_ID || "",
    demoMode: result.data.VITE_DEMO_MODE === "true",
  };
}

export const env = validateEnv();
