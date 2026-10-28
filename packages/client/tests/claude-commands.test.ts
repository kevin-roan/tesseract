import { describe, expect, test } from "bun:test";
import type { ClaudeCommand } from "@tesseract/protocol";
import { ProtocolError, TesseractClient, type FetchLike, type HttpResponse } from "../src/index";

const BASE = "https://tesseract-sandbox.tail1234.ts.net";

const commands: ClaudeCommand[] = [
  { name: "compact", description: "Summarize the conversation to free up context", kind: "command", source: "builtin" },
  { name: "deploy", description: "Deploy an app", kind: "skill", source: "managed" },
  { name: "frontend:review", description: "Review the UI", kind: "command", source: "project" },
];

function respond(status: number, body: unknown): HttpResponse {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `status ${status}`,
    headers: { get: () => null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

function clientWith(replies: Record<string, HttpResponse>) {
  const urls: string[] = [];
  const fetch: FetchLike = async (url, init) => {
    urls.push(url);
    const parsed = new URL(url);
    return replies[`${init.method} ${parsed.pathname}${parsed.search}`] ?? respond(404, { error: { code: "not_found", message: "nope" } });
  };
  return { client: new TesseractClient({ baseUrl: BASE, token: "secret-token", fetch }), urls };
}

describe("claudeCommands", () => {
  test("lists the sandbox's slash commands, optionally for a project", async () => {
    const { client, urls } = clientWith({
      "GET /v1/claude/commands": respond(200, commands.slice(0, 2)),
      "GET /v1/claude/commands?projectId=shop": respond(200, commands),
    });
    expect(await client.claudeCommands()).toEqual(commands.slice(0, 2));
    expect(await client.claudeCommands({ projectId: "shop" })).toEqual(commands);
    expect(urls).toEqual([`${BASE}/v1/claude/commands`, `${BASE}/v1/claude/commands?projectId=shop`]);
  });

  test("rejects a malformed list", async () => {
    const { client } = clientWith({ "GET /v1/claude/commands": respond(200, [{ name: "/Bad Name", description: "", kind: "skill", source: "user" }]) });
    await expect(client.claudeCommands()).rejects.toBeInstanceOf(ProtocolError);
  });
});
