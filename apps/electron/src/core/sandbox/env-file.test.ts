import { describe, expect, it } from "vitest";
import { envFileValue, parseEnvFile, quoteEnvValue, serializeEnv } from "./env-file";

describe("env file", () => {
  it("reads values like the sandbox script (last wins, export, quotes, comments)", () => {
    const text = [
      "# comment",
      "THEONE_MODE=tailscale",
      "  export THEONE_MODE=local",
      'WHISPER_MODELS="base small" # trailing',
      "TZ='Europe/Berlin'",
      "SANDBOX_MEMORY=8g # eight gigs",
      "TOKEN=abc#not-a-comment",
      "EMPTY=",
    ].join("\n");
    const values = parseEnvFile(text);
    expect(values.THEONE_MODE).toBe("local");
    expect(values.WHISPER_MODELS).toBe("base small");
    expect(values.TZ).toBe("Europe/Berlin");
    expect(values.SANDBOX_MEMORY).toBe("8g");
    expect(values.TOKEN).toBe("abc#not-a-comment");
    expect(values.EMPTY).toBe("");
    expect(envFileValue(text, "MISSING")).toBe("");
  });

  it("quotes only when needed and round-trips", () => {
    expect(quoteEnvValue("theone/sandbox:latest")).toBe("theone/sandbox:latest");
    expect(quoteEnvValue("base small")).toBe('"base small"');
    expect(quoteEnvValue("C:\\Users\\me\\.claude")).toBe("'C:\\Users\\me\\.claude'");
    expect(quoteEnvValue("")).toBe("");
    for (const value of ["base small", "/home/a b/.claude", "C:\\Users\\x", "a$b"]) {
      expect(parseEnvFile(`K=${quoteEnvValue(value)}\n`).K).toBe(value);
    }
  });

  it("serializes in .env.example order with a trailing newline", () => {
    const text = serializeEnv({ TZ: "UTC", THEONE_MODE: "local", THEONE_IMAGE: "x/y:z" });
    expect(text).toBe("THEONE_MODE=local\nTHEONE_IMAGE=x/y:z\nTZ=UTC\n");
  });
});
