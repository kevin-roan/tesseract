import { ApiError, type FetchLike, type HttpResponse, type TesseractClient } from "@tesseract/client";
import { IpcError } from "../../../shared/ipc-types";
import { describe, expect, it, vi } from "vitest";
import { ChecksumError, describeDownloadError, downloadUrl, expectedChecksum, normalizeSha, runDownload, sha256Hex, type SaveTarget } from "./download";
import { ARTIFACT_LABELS } from "./labels";

const BODY = new TextEncoder().encode("hello");
const HELLO_SHA = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

function respond(status: number, body: Uint8Array, headers: Record<string, string> = {}): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => new TextDecoder().decode(body),
    arrayBuffer: async () => body.slice().buffer,
  };
}

function target(): SaveTarget & { written: Uint8Array[]; committed: boolean; discarded: boolean } {
  const state = {
    name: "hello.txt",
    written: [] as Uint8Array[],
    committed: false,
    discarded: false,
    write: async (data: Uint8Array) => void state.written.push(data),
    commit: async () => void (state.committed = true),
    discard: async () => void (state.discarded = true),
  };
  return state;
}

describe("runDownload", () => {
  it("hashes, writes and commits a verified file", async () => {
    const fetch = vi.fn<FetchLike>(async () => respond(200, BODY));
    const file = target();
    await expect(runDownload({ url: "http://x/a", headers: { Authorization: "Bearer t" }, fetch, target: file, expectedSha256: ` ${HELLO_SHA.toUpperCase()} ` })).resolves.toBe("hello.txt");
    expect(fetch.mock.calls[0]?.[1].headers).toEqual({ Authorization: "Bearer t" });
    expect(file.written).toHaveLength(1);
    expect(file.committed).toBe(true);
    expect(file.discarded).toBe(false);
  });

  it("discards the file on a checksum mismatch", async () => {
    const file = target();
    const fetch: FetchLike = async () => respond(200, BODY, { "x-content-sha256": "0".repeat(64) });
    await expect(runDownload({ url: "u", headers: {}, fetch, target: file })).rejects.toBeInstanceOf(ChecksumError);
    expect(file.written).toHaveLength(0);
    expect(file.discarded).toBe(true);
  });

  it("maps HTTP errors to ApiError", async () => {
    const file = target();
    const body = new TextEncoder().encode(JSON.stringify({ error: { code: "not_found", message: "Artifact not found" } }));
    const fetch: FetchLike = async () => respond(404, body);
    const error = await runDownload({ url: "u", headers: {}, fetch, target: file }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect(file.discarded).toBe(true);
    expect(describeDownloadError(error, "a.apk is gone")).toBe("Download failed: a.apk is gone");
    expect(describeDownloadError(new ChecksumError(), "x")).toBe(`Download failed: ${ARTIFACT_LABELS.checksum}`);
  });

  it("resolves the expected checksum", async () => {
    expect(await sha256Hex(BODY)).toBe(HELLO_SHA);
    expect(normalizeSha("  ")).toBeNull();
    const response = respond(200, BODY, { "x-content-sha256": "ABC" });
    expect(expectedChecksum(response, null, true)).toBe("abc");
    expect(expectedChecksum(response, null, false)).toBeNull();
    expect(expectedChecksum(response, "DEF", true)).toBe("def");
  });

  it("builds download URLs and treats IPC not_found as missing", () => {
    const client = { httpUrl: (path: string) => `http://sandbox${path}` } as unknown as TesseractClient;
    expect(downloadUrl(client, { kind: "artifact", id: "a 1" })).toBe("http://sandbox/v1/artifacts/a%201/download");
    expect(downloadUrl(client, { kind: "output", projectId: "p", path: "out/app.apk" })).toContain("/v1/projects/p/outputs/download?path=");
    expect(describeDownloadError(new IpcError("not_found", "gone"), "a.apk is gone")).toBe("Download failed: a.apk is gone");
  });
});
