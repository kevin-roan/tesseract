import { describe, expect, it } from "vitest";
import { isPlainProjectId } from "./project-id";

describe("isPlainProjectId", () => {
  it("accepts plain ids", () => {
    expect(isPlainProjectId("proj_123")).toBe(true);
    expect(isPlainProjectId("my-app.v2")).toBe(true);
  });

  it("rejects path tricks and non-strings", () => {
    for (const value of ["..", ".", "../../x", "a/b", "a\\b", "", " ", null, 4]) expect(isPlainProjectId(value)).toBe(false);
  });
});
