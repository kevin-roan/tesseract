import { expect, test } from "bun:test";
import { resolveFetch, resolveWebSocket, type FetchLike, type SocketConstructor } from "../src/index";

test("runtime globals satisfy the structural transport types", () => {
  const globalFetch: FetchLike = fetch;
  const globalWebSocket: SocketConstructor = WebSocket;
  expect(typeof globalFetch).toBe("function");
  expect(resolveWebSocket()).toBe(globalWebSocket);
});

test("resolveFetch looks the global fetch up on every call", async () => {
  const original = globalThis.fetch;
  const seen: string[] = [];
  const fetchImpl = resolveFetch();
  try {
    globalThis.fetch = Object.assign(async (input: string | URL | Request) => {
      seen.push(String(input));
      return new Response("ok");
    }, { preconnect: original.preconnect });
    const response = await fetchImpl("http://example.test/a", {
      method: "GET",
      headers: {},
      signal: new AbortController().signal,
    });
    expect(await response.text()).toBe("ok");
    expect(seen).toEqual(["http://example.test/a"]);
  } finally {
    globalThis.fetch = original;
  }
});
