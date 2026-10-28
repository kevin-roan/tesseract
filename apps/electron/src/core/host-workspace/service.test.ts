import { beforeEach, describe, expect, it, vi } from "vitest";
import { HostWorkspaceService } from "./service";

const mocks = vi.hoisted(() => ({
  linkRepo: vi.fn(),
  readPairing: vi.fn(),
  ensureWorkspaceRunning: vi.fn(),
  runningAccountIds: vi.fn(),
  stopWorkspace: vi.fn(),
}));

vi.mock("./runner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./runner")>()),
  linkRepo: mocks.linkRepo,
  readPairing: mocks.readPairing,
  ensureWorkspaceRunning: mocks.ensureWorkspaceRunning,
  runningAccountIds: mocks.runningAccountIds,
  stopWorkspace: mocks.stopWorkspace,
}));

const RUNNER = { command: ["tesseract-controller"], env: {}, logFile: "/tmp/host-workspace.log" };
const PAIRING = { link: "tesseract://pair?url=http%3A%2F%2F100.64.0.1%3A7702&token=ws-token&name=pc%20(host)", url: "http://100.64.0.1:7702", localUrl: "http://100.64.0.1:7702", name: "pc (host)" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.linkRepo.mockResolvedValue({ id: "app", path: "/home/me/app", created: true });
  mocks.readPairing.mockResolvedValue(PAIRING);
  mocks.ensureWorkspaceRunning.mockResolvedValue(false);
  mocks.runningAccountIds.mockResolvedValue(["claude"]);
  mocks.stopWorkspace.mockResolvedValue(undefined);
});

describe("HostWorkspaceService", () => {
  it("links the host copy under the project id and returns the controller", async () => {
    const service = new HostWorkspaceService({ runner: () => RUNNER, links: async () => [] });
    const target = await service.open({ projectId: "app", hostPath: "/home/me/app" });
    expect(mocks.linkRepo).toHaveBeenCalledWith(RUNNER, "/home/me/app", { id: "app" });
    expect(mocks.ensureWorkspaceRunning).toHaveBeenCalledWith(RUNNER, PAIRING.localUrl);
    expect(target).toEqual({ projectId: "app", apiUrl: PAIRING.localUrl, token: "ws-token", name: "pc (host)" });
    await service.open({ projectId: "app", hostPath: "/home/me/app" });
    expect(mocks.linkRepo).toHaveBeenCalledTimes(1);
    expect(mocks.readPairing).toHaveBeenCalledTimes(1);
  });

  it("links every synced project and logs failures instead of throwing", async () => {
    const warn = vi.fn();
    const links = [
      { projectId: "a", hostPath: "/x/a" },
      { projectId: "b", hostPath: "/x/b" },
    ];
    const service = new HostWorkspaceService({ runner: () => RUNNER, links: async () => links, warn });
    await service.syncAll();
    expect(mocks.linkRepo.mock.calls.map((call) => call[2])).toEqual([{ id: "a" }, { id: "b" }]);
    expect(mocks.ensureWorkspaceRunning).toHaveBeenCalledTimes(1);
    mocks.ensureWorkspaceRunning.mockRejectedValueOnce(new Error("no tailscale"));
    await service.syncAll();
    expect(warn).toHaveBeenCalledWith("host workspace sync failed: no tailscale");
  });

  it("restarts a running controller that has other Claude accounts than the sandbox", async () => {
    const runner = { ...RUNNER, env: { TESSERACT_CLAUDE_ACCOUNTS: "personal=/home/me/.claude-personal" } };
    const service = new HostWorkspaceService({ runner: () => runner, links: async () => [] });
    await service.open({ projectId: "app", hostPath: "/home/me/app" });
    expect(mocks.runningAccountIds).toHaveBeenCalledWith(PAIRING.localUrl, "ws-token");
    expect(mocks.stopWorkspace).toHaveBeenCalledWith(runner, PAIRING.localUrl);
    expect(mocks.ensureWorkspaceRunning).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    mocks.ensureWorkspaceRunning.mockResolvedValue(false);
    mocks.runningAccountIds.mockResolvedValue(["claude-personal", "claude"]);
    await service.open({ projectId: "app", hostPath: "/home/me/app" });
    expect(mocks.stopWorkspace).not.toHaveBeenCalled();
  });

  it("does nothing without synced projects", async () => {
    const service = new HostWorkspaceService({ runner: () => RUNNER, links: async () => [] });
    await service.syncAll();
    expect(mocks.linkRepo).not.toHaveBeenCalled();
    expect(mocks.ensureWorkspaceRunning).not.toHaveBeenCalled();
  });
});
