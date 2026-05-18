// Deno tests for the shared CORS configuration.
//
// Guards the regression from issue #83: the browser sends a custom
// `X-Request-Id` header on the Assistente BWild fetch, which triggers a
// CORS preflight. If `x-request-id` is missing from
// `Access-Control-Allow-Headers`, the browser aborts the real request with
// `TypeError: Failed to fetch` and the assistant becomes fully inoperant.

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { corsHeaders, corsResponse } from "./cors.ts";

Deno.test("Access-Control-Allow-Headers inclui x-request-id", () => {
  const allowed = corsHeaders["Access-Control-Allow-Headers"]
    .split(",")
    .map((h) => h.trim().toLowerCase());
  assert(
    allowed.includes("x-request-id"),
    `x-request-id ausente em Access-Control-Allow-Headers: ${
      corsHeaders["Access-Control-Allow-Headers"]
    }`,
  );
});

Deno.test("x-request-id exposto via Access-Control-Expose-Headers", () => {
  const exposed = (corsHeaders["Access-Control-Expose-Headers"] ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase());
  assert(
    exposed.includes("x-request-id"),
    "x-request-id deveria estar em Access-Control-Expose-Headers",
  );
});

Deno.test("corsResponse() ecoa os headers de CORS no preflight", () => {
  const resp = corsResponse();
  assertEquals(
    resp.headers.get("Access-Control-Allow-Headers")
      ?.toLowerCase()
      .includes("x-request-id"),
    true,
  );
});
