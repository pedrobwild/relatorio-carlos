/* eslint-disable no-console */
// Deno tests for the `assistant-chat` edge function.
//
// Validates two flows end-to-end against the deployed function:
//  1. Anonymous request must be rejected (401).
//  2. Authenticated request must return a structured answer AND persist
//     a row in `assistant_logs` referencing the same question.
//
// Credentials:
//   - VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are loaded from .env
//   - ASSISTANT_TEST_EMAIL / ASSISTANT_TEST_PASSWORD: optional Staff/Admin
//     login used to exercise the authenticated path. When absent, the
//     authenticated test is skipped (with an explicit log) so the suite
//     still passes in environments without seeded test users.

// NOTE: We intentionally do NOT use `dotenv/load.ts` because the project's
// .env declares vars without values that the strict loader rejects. Instead
// we read the few vars we need directly via `Deno.env.get`. The Supabase
// edge-test runner injects VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
// into the test environment automatically.
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY");
const TEST_EMAIL = Deno.env.get("ASSISTANT_TEST_EMAIL");
const TEST_PASSWORD = Deno.env.get("ASSISTANT_TEST_PASSWORD");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env",
  );
}

const FN_URL = `${SUPABASE_URL}/functions/v1/assistant-chat`;
// Stable question used so we can locate the log entry afterwards.
const TEST_QUESTION =
  `__assistant_chat_test__ ${crypto.randomUUID()} — Quantas obras estão com status 'active'?`;

// ---------------------------------------------------------------------------
// 1. Anonymous request must be blocked (function validates JWT in code).
// ---------------------------------------------------------------------------
Deno.test("assistant-chat rejects unauthenticated requests", async () => {
  const res = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY!,
      // Intentionally no Authorization bearer token.
    },
    body: JSON.stringify({ question: "ping" }),
  });
  // Consume body to avoid Deno resource leak warning.
  const body = await res.text();

  assert(
    res.status === 401 || res.status === 403,
    `Expected 401/403 for anonymous call, got ${res.status}. Body: ${body}`,
  );
});

// ---------------------------------------------------------------------------
// 2. Authenticated happy-path: returns answer AND writes assistant_logs row.
// ---------------------------------------------------------------------------
Deno.test("assistant-chat returns answer and persists assistant_logs", async () => {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    console.warn(
      "[skip] ASSISTANT_TEST_EMAIL/ASSISTANT_TEST_PASSWORD not set — " +
        "skipping authenticated round-trip. Add a Staff user to .env to enable.",
    );
    return;
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- sign in as a Staff/Admin user --------------------------------------
  const { data: signIn, error: signInError } = await supabase.auth
    .signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
  assertEquals(
    signInError,
    null,
    `Sign-in failed: ${signInError?.message ?? "unknown error"}`,
  );
  const accessToken = signIn?.session?.access_token;
  const userId = signIn?.user?.id;
  assertExists(accessToken, "No access_token after sign-in");
  assertExists(userId, "No user id after sign-in");

  try {
    // ---- call the edge function with the user's JWT -----------------------
    const startedAt = Date.now();
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ question: TEST_QUESTION }),
    });
    const payload = await res.json();
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `assistant-chat responded in ${elapsedMs}ms with status=${res.status}`,
    );

    assertEquals(
      res.status,
      200,
      `Expected 200, got ${res.status}: ${JSON.stringify(payload)}`,
    );

    // ---- structural assertions on the JSON response -----------------------
    assertExists(payload.answer, "Response missing `answer`");
    assert(
      typeof payload.answer === "string" && payload.answer.length > 0,
      "`answer` should be a non-empty string",
    );
    assertExists(payload.status, "Response missing `status`");
    assert(
      ["success", "sql_blocked", "sql_error", "llm_error", "timeout", "other"]
        .includes(payload.status),
      `Unexpected status value: ${payload.status}`,
    );
    // rows array (may be empty) and rows_returned should be coherent.
    assert(Array.isArray(payload.rows) || payload.rows === undefined);
    if (typeof payload.rows_returned === "number") {
      assert(
        payload.rows_returned >= 0,
        "`rows_returned` should be >= 0",
      );
    }

    // ---- verify the call was logged in assistant_logs ---------------------
    // Small delay: log insert happens at the end of the handler; with the
    // fetch round-trip already done we usually see it immediately, but allow
    // up to ~3s with a poll loop to absorb any async slack.
    let logRow: Record<string, unknown> | null = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const { data, error } = await supabase
        .from("assistant_logs")
        .select(
          "id, user_id, question, status, rows_returned, latency_ms, created_at",
        )
        .eq("user_id", userId)
        .eq("question", TEST_QUESTION)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        throw new Error(`assistant_logs query failed: ${error.message}`);
      }
      if (data) {
        logRow = data as Record<string, unknown>;
        break;
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    assertExists(
      logRow,
      "Expected a row in assistant_logs for the test question, found none",
    );
    assertEquals(logRow!.user_id, userId);
    assertEquals(logRow!.question, TEST_QUESTION);
    assertEquals(
      logRow!.status,
      payload.status,
      "Logged status should match response status",
    );
  } finally {
    // Always sign out so we don't leave a lingering session.
    await supabase.auth.signOut();
  }
});
