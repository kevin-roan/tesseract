import { sampleTerminal } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { folderName, gateEmpty, hostRowModel, hostSessionTitle } from "./model";

describe("host shell model", () => {
  it("names sessions after their folder", () => {
    expect(folderName("/home/me/Projects/tesseract/")).toBe("tesseract");
    expect(folderName("C:\\Users\\me\\app")).toBe("app");
    expect(folderName("")).toBe("Home");
    expect(hostSessionTitle({ kind: "shell", cwd: "/home/me/app" })).toBe("Shell · app");
  });

  it("keeps the shared row model but uses the host title", () => {
    const row = hostRowModel({ ...sampleTerminal, cwd: "/srv/site", projectId: null }, Date.now());
    expect(row.title).toBe("Shell · site");
    expect(row.id).toBe(sampleTerminal.id);
  });

  it("turns the host gate into the terminals empty state", () => {
    expect(gateEmpty(null)).toBeNull();
    expect(
      gateEmpty({ icon: "host", title: "t", message: null, loading: false, action: "unlock", actionLabel: "Unlock", secondary: null, secondaryLabel: null }),
    ).toEqual({ title: "t", message: null, loading: false, icon: "host", actionLabel: "Unlock", secondaryLabel: null });
  });
});
