import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { eventChannel, invokeChannel, isServiceName, parseChannel, SERVICE_NAMES } from "../src/shared/ipc";

const HANDLER_DIR = join(__dirname, "..", "src", "main", "ipc");

describe("IPC contract", () => {
  it("has exactly one handler module per service", () => {
    const handlers = readdirSync(HANDLER_DIR)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => basename(file, ".ts"))
      .sort();
    expect(handlers).toEqual([...SERVICE_NAMES].sort());
  });

  it("round-trips invoke and event channels", () => {
    for (const service of SERVICE_NAMES) {
      expect(parseChannel(invokeChannel(service, "method"))).toEqual({ service, name: "method", event: false });
      expect(parseChannel(eventChannel(service, "changed"))).toEqual({ service, name: "changed", event: true });
    }
  });

  it("rejects unknown channels", () => {
    expect(parseChannel("monolith:nope:method")).toBeNull();
    expect(parseChannel("other:app:runtime")).toBeNull();
    expect(isServiceName("app")).toBe(true);
  });
});
