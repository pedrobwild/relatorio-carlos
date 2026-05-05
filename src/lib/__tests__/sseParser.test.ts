import { describe, it, expect } from "vitest";
import { parseSseBlock, splitSseBuffer } from "../sseParser";

describe("parseSseBlock", () => {
  it("parses a simple LF block", () => {
    const r = parseSseBlock(`event: delta\ndata: {"content":"oi"}`);
    expect(r).toEqual({ event: "delta", data: { content: "oi" } });
  });

  it("handles CRLF line endings", () => {
    const r = parseSseBlock(`event: done\r\ndata: {"status":"ok"}\r\n`);
    expect(r).toEqual({ event: "done", data: { status: "ok" } });
  });

  it("tolerates extra whitespace after colon", () => {
    const r = parseSseBlock(`event:   status\ndata:    {"phase":"sql"}`);
    expect(r).toEqual({ event: "status", data: { phase: "sql" } });
  });

  it("defaults event to 'message' when omitted", () => {
    const r = parseSseBlock(`data: {"x":1}`);
    expect(r).toEqual({ event: "message", data: { x: 1 } });
  });

  it("ignores SSE comments and blank lines", () => {
    const r = parseSseBlock(
      `: keepalive\n\nevent: rows\n\n  \ndata: {"rows_returned":3}`,
    );
    expect(r).toEqual({ event: "rows", data: { rows_returned: 3 } });
  });

  it("returns null for blocks without data:", () => {
    expect(parseSseBlock(`event: ping`)).toBeNull();
    expect(parseSseBlock(``)).toBeNull();
    expect(parseSseBlock(`   \n  \r\n`)).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(parseSseBlock(`data: {not-json}`)).toBeNull();
  });

  it("strips BOM at the beginning", () => {
    const r = parseSseBlock(`\uFEFFevent: delta\ndata: {"content":"a"}`);
    expect(r).toEqual({ event: "delta", data: { content: "a" } });
  });

  it("concatenates multiple data: lines", () => {
    const r = parseSseBlock(`event: done\ndata: {"a":1,\ndata: "b":2}`);
    expect(r).toEqual({ event: "done", data: { a: 1, b: 2 } });
  });
});

describe("splitSseBuffer", () => {
  it("splits on LF double newline", () => {
    const { blocks, rest } = splitSseBuffer(
      `event: a\ndata: {"v":1}\n\nevent: b\ndata: {"v":2}\n\npartial`,
    );
    expect(blocks).toHaveLength(2);
    expect(rest).toBe("partial");
  });

  it("splits on CRLF double newline", () => {
    const { blocks, rest } = splitSseBuffer(
      `event: a\r\ndata: {"v":1}\r\n\r\nevent: b\r\ndata: {"v":2}\r\n\r\n`,
    );
    expect(blocks).toHaveLength(2);
    expect(rest).toBe("");
  });

  it("returns empty blocks list when no terminator yet", () => {
    const { blocks, rest } = splitSseBuffer(`event: a\ndata: {"v":1}`);
    expect(blocks).toEqual([]);
    expect(rest).toBe(`event: a\ndata: {"v":1}`);
  });
});
