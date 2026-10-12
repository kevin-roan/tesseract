import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { colimaConfig, resolveSize } from "./config";
import { MANAGED_MARKER, VM_CONTEXT, VM_PROFILE } from "./constants";

const SCRIPT = readFileSync(join(__dirname, "../../../../../scripts/setup-mac.sh"), "utf8");

function embeddedYaml(): string {
  const match = /cat <<'COLIMA_YAML'\n([\s\S]*?)\nCOLIMA_YAML\n/.exec(SCRIPT);
  if (!match?.[1]) throw new Error("COLIMA_YAML heredoc not found in scripts/setup-mac.sh");
  return match[1];
}

describe("scripts/setup-mac.sh", () => {
  it("embeds exactly the colima.yaml the app generates", () => {
    const expected = colimaConfig({ arch: "aarch64", size: resolveSize(), home: "__TESSERACT_HOME__", resourcesDir: "__TESSERACT_RESOURCES__" });
    expect(embeddedYaml()).toBe(expected.trimEnd());
  });

  it("uses the app's profile, context and marker", () => {
    expect(SCRIPT).toContain(`PROFILE="${VM_PROFILE}"`);
    expect(SCRIPT).toContain('CONTEXT="colima-${PROFILE}"');
    expect(VM_CONTEXT).toBe(`colima-${VM_PROFILE}`);
    expect(SCRIPT).toContain(`MARKER="${MANAGED_MARKER}"`);
  });
});
