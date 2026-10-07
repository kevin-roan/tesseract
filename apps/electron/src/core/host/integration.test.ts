import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { HostShellState } from "../../shared/contracts/hostShell";
import { findBun, resolveControllerCommand } from "./command";
import { HostShellService } from "./service";

const REPO = resolve(__dirname, "..", "..", "..", "..", "..");
const bun = findBun(process.env, process.platform, undefined);
const PIN = "246810";

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => done(port));
    });
  });
}

async function waitFor(check: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() > deadline) throw new Error("timed out");
    await new Promise((done) => setTimeout(done, 50));
  }
}

describe.skipIf(!bun || process.platform === "win32")("host shell daemon (real controller, isolated)", () => {
  let dir: string;
  let port: number;
  let service: HostShellService;
  const states: HostShellState[] = [];

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "monolith-test-host-"));
    port = await freePort();
    const env = {
      ...process.env,
      THEONE_HOST_SHELL_DIR: join(dir, "state"),
      THEONE_HOST_SHELL_PORT: String(port),
      THEONE_HOST_SHELL_BIND: "127.0.0.1",
      THEONE_HOST_SHELL_PUBLIC_URL: `http://127.0.0.1:${port}`,
      THEONE_ANDROID_SDK_ROOT: join(dir, "no-sdk"),
      THEONE_EMULATOR_PORT: "5680",
      MONOLITH_CONTROLLER_COMMAND: undefined,
    };
    service = new HostShellService({
      command: () => resolveControllerCommand({ env, resourcesPath: null, packaged: false, repoRoot: REPO, platform: process.platform }),
      env: () => env,
      platform: process.platform,
      onChange: (state) => states.push(state),
    });
  });

  afterAll(async () => {
    await service?.shutdown();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("sets the PIN, serves, unlocks and stops", async () => {
    expect(port).not.toBe(7701);
    const probed = await service.setPin(PIN);
    expect(probed.pairing).toMatchObject({ url: `http://127.0.0.1:${port}`, pinSet: true });
    expect(probed.status).toBe("stopped");

    await service.start();
    await waitFor(() => service.state().status === "running", 20_000);
    await waitFor(() => service.state().pairing !== null, 20_000);
    expect(service.state().log.some((line) => line.includes("host shell listening"))).toBe(true);

    const page = await fetch(`http://127.0.0.1:${port}/ui/android`);
    expect(page.status).toBe(200);

    await expect(service.unlock("000000")).rejects.toMatchObject({ code: "forbidden" });
    const unlocked = await service.unlock(PIN);
    expect(unlocked.sessionExpiresAt).toBeGreaterThan(Date.now());
    const android = await service.androidStatus();
    expect(android.available).toBe(false);
    expect(android.reason).toBeTruthy();

    const started = Date.now();
    await service.stop();
    await waitFor(() => service.state().status === "stopped", 6_000);
    expect(Date.now() - started).toBeLessThan(6_000);
    expect(states.some((state) => state.status === "stopping")).toBe(true);
    expect(JSON.stringify(states)).not.toContain(PIN);
  }, 60_000);
});
