import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "../../src/config";
import { DisplayService } from "../../src/services/display";
import { makeTempDir, removeTempDirs } from "../helpers";

const SCRIPTS: Record<string, string> = {
  xdpyinfo: 'echo "  dimensions:    1600x900 pixels"',
  wmctrl: `echo "wmctrl $* DISPLAY=$DISPLAY" >> "$CALLS"
[ "$1" = "-lp" ] || exit 0
printf '%s\\n' \\
  "0x00c00003 -1 812    sandbox tint2" \\
  "0x03a00004  0 1234   sandbox Hybrid POS" \\
  "0x03c00001  0 1300   sandbox Chromium"`,
  xprop: `case "$*" in
  "-root _NET_ACTIVE_WINDOW") echo "_NET_ACTIVE_WINDOW(WINDOW): window id # 0x3c00001" ;;
  "-id 0x00c00003"*) echo "WM_CLASS(STRING) = \\"tint2\\", \\"Tint2\\""; echo "_NET_WM_WINDOW_TYPE(ATOM) = _NET_WM_WINDOW_TYPE_DOCK" ;;
  "-id 0x03a00004"*) echo "WM_CLASS(STRING) = \\"hybrid-pos\\", \\"Hybrid POS\\""; echo "_NET_WM_STATE(ATOM) = _NET_WM_STATE_HIDDEN" ;;
  "-id 0x03c00001"*) echo "WM_CLASS(STRING) = \\"chromium\\", \\"Chromium\\""; echo "_NET_WM_STATE:  not found." ;;
esac`,
  xdotool: 'echo "xdotool $*" >> "$CALLS"',
};

let calls = "";
let previousPath: string | undefined;
let previousCalls: string | undefined;

beforeAll(() => {
  const bin = makeTempDir("display-bin");
  for (const [name, body] of Object.entries(SCRIPTS)) {
    const path = join(bin, name);
    writeFileSync(path, `#!/bin/sh\n${body}\n`);
    chmodSync(path, 0o755);
  }
  calls = join(bin, "calls.log");
  writeFileSync(calls, "");
  previousPath = process.env.PATH;
  previousCalls = process.env.CALLS;
  process.env.PATH = `${bin}:${process.env.PATH}`;
  process.env.CALLS = calls;
});

afterAll(() => {
  process.env.PATH = previousPath;
  if (previousCalls === undefined) delete process.env.CALLS;
  else process.env.CALLS = previousCalls;
  removeTempDirs();
});

const service = () =>
  new DisplayService({ display: "fake-display", vncHost: "127.0.0.1", vncPort: 1, vncPassword: null } as unknown as Config, 0);

const callLog = () => readFileSync(calls, "utf8").trim().split("\n").filter(Boolean);

describe("DisplayService windows", () => {
  test("lists application windows and leaves the dock out", async () => {
    expect(await service().windows()).toEqual({
      windows: [
        { id: "0x03a00004", title: "Hybrid POS", app: "Hybrid POS", pid: 1234, active: false, minimized: true },
        { id: "0x03c00001", title: "Chromium", app: "Chromium", pid: 1300, active: true, minimized: false },
      ],
    });
    expect(callLog()).toContain("wmctrl -lp DISPLAY=fake-display");
  });

  test("activates, closes and force-closes a listed window", async () => {
    writeFileSync(calls, "");
    const display = service();
    await display.activateWindow("0x3a00004");
    await display.closeWindow("0x03c00001");
    await display.closeWindow("0x03c00001", true);
    expect(callLog().filter((line) => !line.startsWith("wmctrl -lp"))).toEqual([
      "wmctrl -ia 0x03a00004 DISPLAY=fake-display",
      "wmctrl -ic 0x03c00001 DISPLAY=fake-display",
      "xdotool windowkill 0x03c00001",
    ]);
  });

  test("rejects malformed ids, unknown windows and the dock", async () => {
    const display = service();
    await expect(display.activateWindow("0x03A00004; rm -rf /")).rejects.toMatchObject({ code: "bad_request" });
    await expect(display.closeWindow("0x0badbad")).rejects.toMatchObject({ code: "not_found" });
    await expect(display.closeWindow("0x00c00003")).rejects.toMatchObject({ code: "not_found" });
  });
});
