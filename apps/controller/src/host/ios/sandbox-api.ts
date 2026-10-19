import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { ArtifactSchema, restPaths, type Artifact } from "@tesseract/protocol";
import { errorDetail } from "../android/link";
import type { AndroidLinkConfig } from "../state";

const META_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 30 * 60_000;

/** What the iOS link reads from the sandbox controller with the link token (never sent anywhere else). */
export type SandboxApi = {
  artifact: (id: string) => Promise<Artifact>;
  /** Streams the artifact to `path`; fails beyond `maxBytes` or when its sha256 is not `sha256`. */
  download: (id: string, path: string, sha256: string, maxBytes: number) => Promise<void>;
};

/** Streams a response body to a file, hashing it on the way; past `maxBytes` the download is aborted. */
export async function saveVerified(response: Response, path: string, sha256: string | null, maxBytes: number): Promise<string> {
  if (!response.body) throw new Error("The download has no body");
  const hash = createHash("sha256");
  const file = createWriteStream(path, { mode: 0o600 });
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) throw new Error(`The download is larger than ${maxBytes} bytes`);
      hash.update(chunk);
      if (!file.write(chunk)) await new Promise((resolve) => file.once("drain", resolve));
    }
  } finally {
    await new Promise<void>((resolve) => file.end(() => resolve()));
  }
  const digest = hash.digest("hex");
  if (sha256 && digest !== sha256) throw new Error("The downloaded file does not match the approved sha256");
  return digest;
}

export function sandboxApi(config: AndroidLinkConfig, fetcher: typeof fetch = fetch): SandboxApi {
  const headers = { Authorization: `Bearer ${config.token}` };
  return {
    async artifact(id) {
      const response = await fetcher(`${config.sandboxUrl}${restPaths.artifact(id)}`, { headers, signal: AbortSignal.timeout(META_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`Artifact ${id} is not available (HTTP ${response.status})${await errorDetail(response)}`);
      return ArtifactSchema.parse(await response.json());
    },
    async download(id, path, sha256, maxBytes) {
      const response = await fetcher(`${config.sandboxUrl}${restPaths.artifactDownload(id)}`, { headers, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`Downloading artifact ${id} failed (HTTP ${response.status})${await errorDetail(response)}`);
      await saveVerified(response, path, sha256, maxBytes);
    },
  };
}
