import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli, tempSandbox, type Sandbox } from "../testing";
import { appArgs, deepLink, pageFrom } from "./open";

const mocks = vi.hoisted(() => ({ launchDetached: vi.fn(), runCommand: vi.fn() }));

vi.mock("../../src/core/docker/system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/docker/system")>()),
  launchDetached: mocks.launchDetached,
}));

vi.mock("../../src/core/process", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/core/process")>()),
  runCommand: mocks.runCommand,
}));

let sandbox: Sandbox;

beforeEach(() => {
  sandbox = tempSandbox();
});

afterEach(() => {
  sandbox.cleanup();
  vi.clearAllMocks();
});

describe("open helpers", () => {
  it("validates the page", () => {
    expect(pageFrom([])).toBe("overview");
    expect(pageFrom(["terminals"])).toBe("terminals");
    expect(() => pageFrom(["settings"])).toThrow(/unknown page settings/);
  });

  it("builds app arguments and deep links", () => {
    expect(appArgs("agents")).toEqual(["--page", "agents"]);
    expect(deepLink("display")).toBe("tesseract://display");
  });
});

describe("tesseract open", () => {
  it("launches the installed app with the page", async () => {
    sandbox.runtime.appExecutable = () => "/opt/Tesseract/tesseract-desktop";
    const result = await runCli(sandbox, ["open", "projects", "--json"]);
    expect(result.code).toBe(0);
    expect(mocks.launchDetached).toHaveBeenCalledWith("/opt/Tesseract/tesseract-desktop", ["--page", "projects"], sandbox.env);
    expect(JSON.parse(result.out.join("\n"))).toEqual({ via: "app", target: "/opt/Tesseract/tesseract-desktop", page: "projects" });
  });

  it("falls back to the deep link, then reports a missing app", async () => {
    sandbox.runtime.appExecutable = () => null;
    mocks.runCommand.mockResolvedValueOnce({ code: 0, stdout: "", stderr: "", timedOut: false });
    const linked = await runCli(sandbox, ["open"]);
    expect(mocks.runCommand).toHaveBeenCalledWith("xdg-open", ["tesseract://overview"], expect.any(Object));
    expect(linked.out).toEqual(["Asked the system to open tesseract://overview"]);
    mocks.runCommand.mockResolvedValueOnce({ code: 4, stdout: "", stderr: "", timedOut: false });
    const missing = await runCli(sandbox, ["open"]);
    expect(missing.code).toBe(1);
    expect(missing.err[0]).toContain("TESSERACT_APP_PATH");
  });
});
