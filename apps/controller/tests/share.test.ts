import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ArtifactSchema,
  ErrorBodySchema,
  InboxSchema,
  TaildropTargetsSchema,
  type Artifact,
  type Inbox,
  type ServerEvent,
} from "@theone/protocol";
import { runCli, type Output } from "../src/cli/commands";
import { formatBytes, sharedFileName, sharedPlatform } from "../src/services/artifacts";
import { mapFileTarget } from "../src/services/taildrop";
import { makeTempDir, removeTempDirs, startTestController, TEST_TOKEN, writeFiles, type TestController } from "./helpers";

const APK = "projects/app/android/app/build/outputs/apk/release/app-release.apk";

const FILE_TARGETS = [
  {
    Node: {
      StableID: "nPixel123CNTRL",
      Name: "pixel.tail1234.ts.net.",
      ComputedName: "pixel",
      Hostinfo: { Hostname: "pixel", OS: "android" },
      Online: true,
    },
    PeerAPIURL: "http://100.64.0.2:12345",
  },
  { Node: { StableID: "nLaptop456CNTRL", Name: "laptop.tail1234.ts.net.", Hostinfo: { OS: "windows" }, Online: false } },
  { Node: { Name: "no-id.tail1234.ts.net." } },
];

type Put = { method: string; path: string; length: string | null; body: string };

let t: TestController;
let events: ServerEvent[];
let socketDir: string;
let fake: Server<undefined>;
const puts: Put[] = [];

beforeAll(async () => {
  socketDir = makeTempDir("taildrop");
  const socket = join(socketDir, "tailscaled.sock");
  fake = Bun.serve({
    unix: socket,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.headers.get("sec-tailscale") !== "localapi") return new Response("missing header", { status: 403 });
      if (url.pathname === "/localapi/v0/file-targets") return Response.json(FILE_TARGETS);
      if (url.pathname.startsWith("/localapi/v0/file-put/")) {
        const body = await request.text();
        puts.push({ method: request.method, path: url.pathname, length: request.headers.get("content-length"), body });
        if (url.pathname.includes("/nLaptop456CNTRL/")) return new Response("peer offline", { status: 500 });
        return new Response(null, { status: 200 });
      }
      return new Response("not found", { status: 404 });
    },
  });
  t = await startTestController({ env: { THEONE_TAILSCALE_SOCKET: socket } });
  events = [];
  t.controller.services.hub.subscribe((event) => events.push(event));
  writeFiles(t.workspace, {
    [APK]: "apk-bytes",
    "projects/app/README.md": "# app",
    "projects/web/dist/report.pdf": "%PDF",
    "scratch/notes.txt": "notes",
  });
});

afterAll(async () => {
  await t.stop();
  await fake.stop(true);
  removeTempDirs();
});

async function share(body: Record<string, unknown>) {
  return t.json<Artifact>("POST", "/v1/artifacts", body);
}

async function inbox(): Promise<Inbox> {
  return InboxSchema.parse((await t.json("GET", "/v1/inbox")).body);
}

describe("POST /v1/artifacts", () => {
  test("copies a project file, indexes it and announces it in the inbox", async () => {
    const source = join(t.workspace, APK);
    const { status, body } = await share({ path: source, note: "Release build for testing" });
    expect(status).toBe(201);
    const artifact = ArtifactSchema.parse(body);
    expect(artifact).toMatchObject({
      projectId: "app",
      buildId: null,
      fileName: "app-release.apk",
      path: join(t.workspace, "artifacts", "app-release.apk"),
      sizeBytes: 9,
      platform: "android",
      source: "agent",
      agentRunId: null,
      note: "Release build for testing",
    });
    expect(existsSync(source)).toBe(true);
    expect(events).toContainEqual({ type: "artifact.created", artifact });

    const item = (await inbox()).items.find((entry) => entry.artifactId === artifact.id);
    expect(item).toMatchObject({ kind: "file", title: "New file: app-release.apk", body: "Release build for testing", projectId: "app", readAt: null });

    const ticket = await t.ticket();
    const download = await fetch(`${t.baseUrl}/v1/artifacts/${artifact.id}/download?ticket=${ticket}`);
    expect(download.headers.get("content-type")).toBe("application/vnd.android.package-archive");
    expect(await download.text()).toBe("apk-bytes");
  });

  test("repeated shares get -2, -3 names and separate inbox items, even in one session", async () => {
    const path = join(t.workspace, APK);
    const second = (await share({ path, sessionId: "sess-share" })).body;
    const third = (await share({ path, sessionId: "sess-share" })).body;
    expect([second.fileName, third.fileName]).toEqual(["app-release-2.apk", "app-release-3.apk"]);
    const items = (await inbox()).items.filter((entry) => entry.sessionId === "sess-share");
    expect(items.map((entry) => entry.artifactId).sort()).toEqual([second.id, third.id].sort());
    expect(items.every((entry) => entry.kind === "file" && entry.body === `${formatBytes(9)} · app`)).toBe(true);
  });

  test("name, explicit project and unknown agent runs", async () => {
    const renamed = await share({ path: join(t.workspace, "projects/web/dist/report.pdf"), name: "Q3 report.pdf" });
    expect(renamed.body).toMatchObject({ fileName: "Q3 report.pdf", projectId: "web", platform: "file" });

    const scratch = join(t.workspace, "scratch/notes.txt");
    const outsideProject = await share({ path: scratch });
    expect(outsideProject.status).toBe(400);
    expect(ErrorBodySchema.parse(outsideProject.body).error.message).toContain("--project");
    const explicit = await share({ path: scratch, projectId: "app", agentRunId: "run_unknown0001" });
    expect(explicit.status).toBe(201);
    expect(explicit.body).toMatchObject({ projectId: "app", agentRunId: null, fileName: "notes.txt" });
    expect((await share({ path: scratch, projectId: "nope" })).status).toBe(404);
  });

  test("refuses paths outside the workspace, symlink escapes, directories and controller files", async () => {
    const outside = join(makeTempDir("outside"), "secret.apk");
    writeFileSync(outside, "secret");
    expect((await share({ path: outside })).status).toBe(403);

    const link = join(t.workspace, "projects/app/escape.apk");
    symlinkSync(outside, link);
    expect((await share({ path: link })).status).toBe(403);

    mkdirSync(join(t.workspace, "projects/app/folder"), { recursive: true });
    expect((await share({ path: join(t.workspace, "projects/app/folder") })).status).toBe(400);
    expect((await share({ path: join(t.workspace, "projects/app/missing.apk") })).status).toBe(404);
    expect((await share({ path: join(t.workspace, "artifacts/app-release.apk"), projectId: "app" })).status).toBe(403);
    expect((await share({ path: join(t.config.dataDir, "state.db"), projectId: "app" })).status).toBe(403);
    expect((await share({ path: "relative/app.apk" })).status).toBe(400);
  });
});

describe("DELETE /v1/artifacts/:id", () => {
  test("removes the file and row, clears the inbox link and publishes artifact.deleted", async () => {
    const created = (await share({ path: join(t.workspace, "projects/app/README.md") })).body;
    const { status, body } = await t.json<Artifact>("DELETE", `/v1/artifacts/${created.id}`);
    expect(status).toBe(200);
    expect(body.id).toBe(created.id);
    expect(existsSync(created.path)).toBe(false);
    expect(events).toContainEqual({ type: "artifact.deleted", id: created.id });
    expect((await t.request("GET", `/v1/artifacts/${created.id}/download`)).status).toBe(404);
    expect((await t.json<Artifact[]>("GET", "/v1/artifacts")).body.some((artifact) => artifact.id === created.id)).toBe(false);
    const item = (await inbox()).items.find((entry) => entry.title === "New file: README.md");
    expect(item).toMatchObject({ kind: "file", artifactId: null });
    expect((await t.request("DELETE", `/v1/artifacts/${created.id}`)).status).toBe(404);
  });
});

describe("Taildrop", () => {
  test("lists file targets from the LocalAPI", async () => {
    const targets = TaildropTargetsSchema.parse((await t.json("GET", "/v1/taildrop/targets")).body);
    expect(targets).toEqual({
      available: true,
      targets: [
        { id: "nLaptop456CNTRL", hostName: "laptop", dnsName: "laptop.tail1234.ts.net", os: "windows", online: false },
        { id: "nPixel123CNTRL", hostName: "pixel", dnsName: "pixel.tail1234.ts.net", os: "android", online: true },
      ],
    });
  });

  test("streams the artifact to the target and maps failures", async () => {
    const artifact = (await share({ path: join(t.workspace, APK), name: "my app.apk" })).body;
    const sent = await t.json<Artifact>("POST", `/v1/artifacts/${artifact.id}/taildrop`, { targetId: "nPixel123CNTRL" });
    expect(sent.status).toBe(200);
    expect(sent.body.id).toBe(artifact.id);
    expect(puts.at(-1)).toEqual({ method: "PUT", path: "/localapi/v0/file-put/nPixel123CNTRL/my%20app.apk", length: "9", body: "apk-bytes" });

    expect((await t.json("POST", `/v1/artifacts/${artifact.id}/taildrop`, { targetId: "nLaptop456CNTRL" })).status).toBe(503);
    expect((await t.json("POST", `/v1/artifacts/${artifact.id}/taildrop`, { targetId: "nGone" })).status).toBe(404);
    expect((await t.json("POST", "/v1/artifacts/art_missing000/taildrop", { targetId: "nPixel123CNTRL" })).status).toBe(404);
    expect((await t.json("POST", `/v1/artifacts/${artifact.id}/taildrop`, {})).status).toBe(400);
  });

  test("without the LocalAPI socket targets are unavailable and sends fail with 503", async () => {
    const plain = await startTestController();
    try {
      writeFiles(plain.workspace, { "projects/app/out.zip": "zip" });
      expect((await plain.json("GET", "/v1/taildrop/targets")).body).toEqual({ available: false, targets: [] });
      const artifact = (await plain.json<Artifact>("POST", "/v1/artifacts", { path: join(plain.workspace, "projects/app/out.zip") })).body;
      const response = await plain.json("POST", `/v1/artifacts/${artifact.id}/taildrop`, { targetId: "nPixel123CNTRL" });
      expect(response.status).toBe(503);
    } finally {
      await plain.stop();
    }
  });

  test("an injected fetch replaces the socket", async () => {
    const calls: string[] = [];
    const injected = await startTestController({
      controller: {
        taildrop: {
          fetch: async (path, _signal, init) => {
            calls.push(`${init?.method ?? "GET"} ${path}`);
            return path.endsWith("file-targets") ? Response.json(FILE_TARGETS) : new Response("access denied", { status: 403 });
          },
        },
      },
    });
    try {
      writeFiles(injected.workspace, { "projects/app/out.zip": "zip" });
      const artifact = (await injected.json<Artifact>("POST", "/v1/artifacts", { path: join(injected.workspace, "projects/app/out.zip") })).body;
      const response = await injected.json("POST", `/v1/artifacts/${artifact.id}/taildrop`, { targetId: "nPixel123CNTRL" });
      expect(response.status).toBe(403);
      expect(calls).toEqual(["GET /localapi/v0/file-targets", "PUT /localapi/v0/file-put/nPixel123CNTRL/out.zip"]);
    } finally {
      await injected.stop();
    }
  });
});

describe("theone-controller share", () => {
  function capture(): Output & { stdout: string[]; stderr: string[] } {
    const stdout: string[] = [];
    const stderr: string[] = [];
    return { stdout, stderr, out: (text) => stdout.push(text), err: (text) => stderr.push(text) };
  }

  const cliEnv = (extra: Record<string, string> = {}) => ({
    THEONE_WORKSPACE: t.workspace,
    THEONE_HOST: "127.0.0.1",
    THEONE_PORT: String(t.controller.url.port),
    THEONE_TOKEN: TEST_TOKEN,
    ...extra,
  });

  test("shares a path relative to the cwd and tags the Claude session", async () => {
    const output = capture();
    const cwd = join(t.workspace, "projects/app/android");
    const code = await runCli(["share", "app/build/outputs/apk/release/app-release.apk", "--note", "try this one"], {
      env: cliEnv({ CLAUDE_CODE_SESSION_ID: "sess-cli", THEONE_AGENT_RUN_ID: "run_unknown0002" }),
      output,
      cwd,
    });
    expect(code).toBe(0);
    expect(output.stdout[0]).toMatch(/^shared app-release-\d+\.apk \(9 B, app\) as art_/);
    const item = (await inbox()).items.find((entry) => entry.sessionId === "sess-cli");
    expect(item).toMatchObject({ kind: "file", body: "try this one", projectId: "app" });
  });

  test("--json prints the artifact; errors exit non-zero", async () => {
    const output = capture();
    const code = await runCli(["share", join(t.workspace, "scratch/notes.txt"), "--project", "web", "--name", "n.txt", "--json"], { env: cliEnv(), output, cwd: "/" });
    expect(code).toBe(0);
    expect(ArtifactSchema.parse(JSON.parse(output.stdout[0] ?? "{}"))).toMatchObject({ projectId: "web", fileName: "n.txt" });

    const failed = capture();
    expect(await runCli(["share", "scratch/notes.txt"], { env: cliEnv(), output: failed, cwd: t.workspace })).toBe(1);
    expect(failed.stderr[0]).toContain("bad_request");

    const usage = capture();
    expect(await runCli(["share"], { env: cliEnv(), output: usage, cwd: t.workspace })).toBe(2);
  });
});

describe("helpers", () => {
  test("shared names, platforms and sizes", () => {
    expect(sharedFileName("app-release.apk", 1)).toBe("app-release.apk");
    expect(sharedFileName("app-release.apk", 2)).toBe("app-release-2.apk");
    expect(sharedFileName("site.tar.gz", 3)).toBe("site-3.tar.gz");
    expect(sharedFileName("Makefile", 2)).toBe("Makefile-2");
    expect(sharedFileName(".env", 2)).toBe(".env-2");
    expect(["a.aab", "b.msi", "c.AppImage", "d.rpm", "e.zip"].map(sharedPlatform)).toEqual(["android", "windows", "linux", "linux", "file"]);
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MiB");
    expect(mapFileTarget({ Node: { StableID: "x" } })).toBeNull();
    expect(mapFileTarget(null)).toBeNull();
  });
});
