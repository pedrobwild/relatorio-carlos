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
          "id, user_id, question, status, rows_returned, latency_ms, created_at, answer_length, finish_reason, truncated, truncation_reason, answer_summary",
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

    // ---- novos campos de telemetria de truncamento -----------------------
    // answer_length deve refletir o tamanho real da resposta retornada e
    // bater com o prefixo armazenado em answer_summary (até 280 chars).
    assertEquals(
      typeof logRow!.answer_length,
      "number",
      "answer_length deve ser numérico",
    );
    assertEquals(
      logRow!.answer_length,
      (payload.answer as string).length,
      "answer_length deve ser igual ao length da resposta retornada",
    );
    assertEquals(
      logRow!.answer_summary,
      (payload.answer as string).slice(0, 280),
      "answer_summary deve ser o prefixo (≤280) de answer",
    );
    // truncated é boolean (não-nulo) e truncation_reason segue a invariante:
    //   truncated=false  <=> truncation_reason IS NULL
    //   truncated=true   <=> truncation_reason IN (lista conhecida)
    assertEquals(
      typeof logRow!.truncated,
      "boolean",
      "truncated deve ser boolean",
    );
    const KNOWN_REASONS = new Set([
      "finish_reason=length",
      "answer_too_short",
      "unclosed_code_fence",
      "no_terminal_punctuation",
    ]);
    if (logRow!.truncated === true) {
      assert(
        typeof logRow!.truncation_reason === "string" &&
          KNOWN_REASONS.has(logRow!.truncation_reason as string),
        `truncation_reason inválido para truncated=true: ${logRow!.truncation_reason}`,
      );
    } else {
      assertEquals(
        logRow!.truncation_reason,
        null,
        "truncation_reason deve ser null quando truncated=false",
      );
    }
    // finish_reason: pode ser null (stream sem finish) ou string ('stop' | 'length' | ...)
    assert(
      logRow!.finish_reason === null ||
        typeof logRow!.finish_reason === "string",
      `finish_reason deve ser null ou string, recebido: ${typeof logRow!.finish_reason}`,
    );
    // Coerência cruzada: se o LLM declarou 'length', o handler DEVE marcar truncated.
    if (logRow!.finish_reason === "length") {
      assertEquals(
        logRow!.truncated,
        true,
        "finish_reason=length deve sempre marcar truncated=true",
      );
      assertEquals(logRow!.truncation_reason, "finish_reason=length");
    }
  } finally {
    // Always sign out so we don't leave a lingering session.
    await supabase.auth.signOut();
  }
});
