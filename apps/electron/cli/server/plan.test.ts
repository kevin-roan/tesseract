import { describe, expect, it } from "vitest";
import type { FileProbe } from "../../src/core/host";
import type { SetupChoices } from "../../src/shared/contracts/sandbox";
import {
  controllerCommand,
  imageMode,
  installChoices,
  launchdPlist,
  parseServerState,
  planHostService,
  resolveTailscale,
  hostShellBind,
  serveEntry,
  serviceEnv,
  systemdUnit,
  tailscaleServeArgs,
  tailscaleServeOffArgs,
  type ServerOptions,
} from "./plan";

function files(executables: string[]): FileProbe {
  return { isFile: (path) => executables.includes(path), isExecutable: (path) => executables.includes(path) };
}

const OPTIONS: ServerOptions = {
  mode: "tailscale",
  hostname: null,
  tailnetDomain: "example.ts.net",
  authKey: "tskey-auth-1",
  components: null,
  image: null,
  build: false,
  claudeToken: null,
  hostShell: true,
  httpsPort: 8443,
  resetTailscale: false,
  dryRun: false,
};

const BASE = {
  mode: "local",
  tsAuthKey: "",
  tailnetDomain: "",
  hostname: "tesseract-sandbox",
  bindAddr: "",
  components: ["android", "flutter", "mono", "whisper"],
  image: "tesseract/sandbox:latest",
} as unknown as SetupChoices;

describe("hostShellBind", () => {
  it("uses loopback behind serve on macOS and the tailnet IP elsewhere", () => {
    expect(hostShellBind("darwin", "100.72.32.55")).toBe("127.0.0.1");
    expect(hostShellBind("linux", "100.72.32.55")).toBe("100.72.32.55");
  });
});

describe("resolveTailscale", () => {
  it("prefers the macOS app bundle, then PATH and Homebrew", () => {
    const app = "/Applications/Tailscale.app/Contents/MacOS/Tailscale";
    expect(resolveTailscale({ PATH: "/usr/local/bin" }, "darwin", files([app, "/usr/local/bin/tailscale"]))).toBe(app);
    expect(resolveTailscale({ PATH: "/usr/bin:/opt/bin" }, "darwin", files(["/opt/bin/tailscale"]))).toBe("/opt/bin/tailscale");
    expect(resolveTailscale({ PATH: "/usr/bin" }, "darwin", files([app, "/opt/homebrew/bin/tailscale"]))).toBe(app);
    expect(resolveTailscale({ PATH: "/usr/bin" }, "darwin", files(["/opt/homebrew/bin/tailscale"]))).toBe("/opt/homebrew/bin/tailscale");
    expect(resolveTailscale({ PATH: "" }, "darwin", files([]))).toBeNull();
  });

  it("does not look in the macOS app bundle on Linux", () => {
    expect(resolveTailscale({ PATH: "" }, "linux", files(["/Applications/Tailscale.app/Contents/MacOS/Tailscale"]))).toBeNull();
    expect(resolveTailscale({ PATH: "" }, "linux", files(["/usr/bin/tailscale"]))).toBe("/usr/bin/tailscale");
  });
});

describe("controllerCommand", () => {
  it("uses the binary next to tesseract, or the override", () => {
    const probe = files(["/Users/me/.tesseract/bin/tesseract-controller"]);
    expect(controllerCommand("/Users/me/.tesseract/bin/tesseract", {}, "darwin", probe)).toEqual(["/Users/me/.tesseract/bin/tesseract-controller"]);
    expect(controllerCommand("/tmp/tesseract", {}, "darwin", probe)).toBeNull();
    expect(controllerCommand("/tmp/tesseract", { TESSERACT_CONTROLLER_COMMAND: "bun /repo/apps/controller/src/index.ts" }, "linux", probe)).toEqual([
      "bun",
      "/repo/apps/controller/src/index.ts",
    ]);
  });
});

describe("planHostService", () => {
  const input = {
    home: "/Users/me",
    uid: 501,
    command: ["/Users/me/.tesseract/bin/tesseract-controller"],
    bind: "100.64.0.7",
    tailscale: "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
    env: { HOME: "/Users/me", SHELL: "/bin/zsh", SECRET: "x" },
  };

  it("writes a LaunchAgent on macOS", () => {
    const plan = planHostService({ ...input, platform: "darwin" });
    expect(plan.kind).toBe("launchd");
    expect(plan.file).toBe("/Users/me/Library/LaunchAgents/dev.tesseract.host-shell.plist");
    expect(plan.logDir).toBe("/Users/me/Library/Logs/Tesseract");
    expect(plan.text).toContain("<string>dev.tesseract.host-shell</string>");
    expect(plan.text).toContain(
      [
        "    <string>/Users/me/.tesseract/bin/tesseract-controller</string>",
        "    <string>host</string>",
        "    <string>serve</string>",
        "    <string>--bind</string>",
        "    <string>100.64.0.7</string>",
      ].join("\n"),
    );
    expect(plan.text).toContain("<key>RunAtLoad</key>\n  <true/>");
    expect(plan.text).toContain("<key>KeepAlive</key>\n  <true/>");
    expect(plan.text).toContain(
      "<string>/Applications/Tailscale.app/Contents/MacOS:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>",
    );
    expect(plan.text).toContain("<string>/Users/me/Library/Logs/Tesseract/host-shell.log</string>");
    expect(plan.text).not.toContain("SECRET");
    expect(plan.install.map((step) => [step.file, ...step.args].join(" "))).toEqual([
      "launchctl bootout gui/501/dev.tesseract.host-shell",
      "launchctl bootstrap gui/501 /Users/me/Library/LaunchAgents/dev.tesseract.host-shell.plist",
      "launchctl enable gui/501/dev.tesseract.host-shell",
    ]);
    expect(plan.install[0]?.optional).toBe(true);
    expect(plan.install[1]?.optional).toBeUndefined();
    expect(plan.install[1]?.retries).toBeGreaterThan(0);
  });

  it("writes a systemd user unit on Linux", () => {
    const plan = planHostService({ ...input, platform: "linux", home: "/home/me", command: ["/home/me/my bin/tesseract-controller"] });
    expect(plan.kind).toBe("systemd");
    expect(plan.file).toBe("/home/me/.config/systemd/user/tesseract-host-shell.service");
    expect(plan.text).toContain('ExecStart="/home/me/my bin/tesseract-controller" host serve --bind 100.64.0.7');
    expect(plan.text).toContain("Environment=HOME=/home/me");
    expect(plan.text).toContain("Restart=always");
    expect(plan.install.map((step) => step.args.join(" "))).toEqual([
      "--user daemon-reload",
      "--user enable tesseract-host-shell.service",
      "--user restart tesseract-host-shell.service",
    ]);
    expect(plan.status.args).toEqual(["--user", "is-active", "tesseract-host-shell.service"]);
  });

  it("escapes XML and keeps only the listed env keys", () => {
    expect(launchdPlist("a&b", ["<x>"], { K: '"v"' }, "/l")).toContain("<string>&lt;x&gt;</string>");
    expect(launchdPlist("a&b", [], {}, "/l")).toContain("<string>a&amp;b</string>");
    expect(serviceEnv({ env: { SHELL: "/bin/zsh", TOKEN: "t" }, home: "/h", tailscale: null })).toEqual({
      SHELL: "/bin/zsh",
      HOME: "/h",
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
    });
    expect(systemdUnit(["/bin/x"], { A: "b c" })).toContain('Environment="A=b c"');
  });
});

describe("tailscale serve", () => {
  it("builds the serve commands", () => {
    expect(tailscaleServeArgs(8443, "100.64.0.7")).toEqual(["serve", "--bg", "--https=8443", "http://100.64.0.7:7701"]);
    expect(tailscaleServeOffArgs(8443)).toEqual(["serve", "--https=8443", "off"]);
  });

  it("finds the entry for the port in serve status", () => {
    const status = JSON.stringify({
      Web: {
        "mac.example.ts.net:8443": { Handlers: { "/": { Proxy: "http://100.64.0.7:7701" } } },
        "mac.example.ts.net:443": { Handlers: { "/": { Proxy: "http://127.0.0.1:3000" } } },
      },
    });
    expect(serveEntry(status, 8443)).toBe("https://mac.example.ts.net:8443 → http://100.64.0.7:7701");
    expect(serveEntry(status, 9443)).toBeNull();
    expect(serveEntry("not json", 8443)).toBeNull();
  });
});

describe("install choices", () => {
  it("applies the options over the saved choices", () => {
    const choices = installChoices(BASE, { ...OPTIONS, hostname: "mac-sandbox", components: [], image: "ghcr.io/me/sandbox:1" }, null);
    expect(choices).toMatchObject({
      mode: "tailscale",
      tsAuthKey: "tskey-auth-1",
      tailnetDomain: "example.ts.net",
      hostname: "mac-sandbox",
      components: [],
      image: "ghcr.io/me/sandbox:1",
    });
    expect(installChoices(BASE, { ...OPTIONS, mode: "host-tailscale", authKey: null }, "100.64.0.7")).toMatchObject({
      mode: "host-tailscale",
      tsAuthKey: "",
      bindAddr: "100.64.0.7",
      hostname: "tesseract-sandbox",
    });
  });

  it("builds, reuses or pulls the image", () => {
    expect(imageMode({ build: true, image: null }, true)).toBe("build");
    expect(imageMode({ build: false, image: null }, true)).toBe("existing");
    expect(imageMode({ build: false, image: null }, false)).toBe("pull");
    expect(imageMode({ build: false, image: "ghcr.io/me/sandbox:1" }, true)).toBe("pull");
  });

  it("parses the saved server state", () => {
    expect(parseServerState(null)).toEqual({ httpsPort: null, bind: null, serviceFile: null, tailscale: null });
    expect(parseServerState('{"httpsPort":8443,"bind":"100.64.0.7","serviceFile":"/f","tailscale":"/t"}')).toEqual({
      httpsPort: 8443,
      bind: "100.64.0.7",
      serviceFile: "/f",
      tailscale: "/t",
    });
    expect(parseServerState("{")).toEqual({ httpsPort: null, bind: null, serviceFile: null, tailscale: null });
  });
});
