import { ApiError, TesseractClient, type FetchLike, type HttpResponse } from "@tesseract/client";
import type { ClaudeCommand } from "@tesseract/protocol";
import { describe, expect, it, vi } from "vitest";
import { fetchClaudeCommands, toSlashCommands } from "./slash-commands";

const commands: ClaudeCommand[] = [
  { name: "deploy", description: "Deploy an app", kind: "skill", source: "managed" },
  { name: "review", description: "", kind: "command", source: "user" },
  { name: "notes", description: "Release notes", kind: "command", source: "project" },
  { name: "init", description: "Initialize", kind: "command", source: "builtin" },
];

function reply(status: number, body: unknown): HttpResponse {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: () => null },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

const client = new TesseractClient({ baseUrl: "http://sandbox.test:7000", token: "secret" });

describe("toSlashCommands", () => {
  it("prefixes names and tags them by source or kind", () => {
    expect(toSlashCommands(commands)).toEqual([
      { command: "/deploy", description: "Deploy an app", tag: "skill" },
      { command: "/review", description: undefined, tag: "user" },
      { command: "/notes", description: "Release notes", tag: "project" },
      { command: "/init", description: "Initialize", tag: "command" },
    ]);
  });
});

describe("fetchClaudeCommands", () => {
  it("requests the project's commands with auth", async () => {
    const fetch = vi.fn<FetchLike>(async () => reply(200, commands));
    const result = await fetchClaudeCommands(client, fetch, "proj_1", new AbortController().signal);
    expect(result).toEqual(commands);
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("http://sandbox.test:7000/v1/claude/commands?projectId=proj_1");
    expect(init?.headers.Authorization).toBe("Bearer secret");
  });

  it("omits the project filter without a project", async () => {
    const fetch = vi.fn<FetchLike>(async () => reply(200, []));
    await fetchClaudeCommands(client, fetch, "", new AbortController().signal);
    expect(fetch.mock.calls[0]?.[0]).toBe("http://sandbox.test:7000/v1/claude/commands");
  });

  it("rejects when an older sandbox has no endpoint", async () => {
    const fetch = vi.fn<FetchLike>(async () => reply(404, { error: { code: "not_found", message: "Not found" } }));
    await expect(fetchClaudeCommands(client, fetch, "proj_1", new AbortController().signal)).rejects.toBeInstanceOf(ApiError);
  });
});
