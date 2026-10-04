import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const UI_DIR = join(import.meta.dir, "../../src/ui");
const PAGES = ["terminal.ts", "android.ts", "vnc.ts"];

describe("ui bundle", () => {
  test.each(PAGES)("%s does not pull in zod", async (page) => {
    const result = await Bun.build({ entrypoints: [join(UI_DIR, page)], target: "browser" });
    expect(result.success).toBe(true);
    for (const output of result.outputs) {
      const code = await output.text();
      expect(code).not.toContain("$ZodType");
      expect(code).not.toContain("zod/v4");
    }
  });
});
