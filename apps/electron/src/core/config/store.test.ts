import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { initialConnection, withConnection } from "./connection";
import { readConfig, updateConfig } from "./store";

const dirs: string[] = [];
const tempFile = () => {
  const dir = mkdtempSync(join(tmpdir(), "tesseract-test-config-"));
  dirs.push(dir);
  return join(dir, "nested", "config.json");
};

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("config store", () => {
  it("returns {} for missing or invalid files", async () => {
    expect(await readConfig(tempFile())).toEqual({});
  });

  it("writes pretty JSON with a trailing newline, mode 0600, preserving unknown keys", async () => {
    const file = tempFile();
    await updateConfig(file, () => ({ zoom: 1.1, custom: { a: 1 } }));
    await updateConfig(file, (data) => withConnection(data, { apiUrl: "http://127.0.0.1:7700", token: " t0ken ", name: "" }));
    const text = readFileSync(file, "utf8");
    expect(text.endsWith("}\n")).toBe(true);
    expect(JSON.parse(text)).toEqual({ zoom: 1.1, custom: { a: 1 }, url: "http://127.0.0.1:7700", token: "t0ken" });
    if (process.platform !== "win32") expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it("prefers the file over the environment and accepts the legacy apiUrl key", () => {
    const env = { TESSERACT_DESKTOP_URL: "http://env:7700", TESSERACT_TOKEN: "envtoken" };
    expect(initialConnection({ apiUrl: "http://file:7700", token: "f" }, env)?.source).toBe("file");
    expect(initialConnection({}, env)).toMatchObject({ apiUrl: "http://env:7700", source: "env" });
    expect(initialConnection({}, {})).toBeNull();
  });
});
