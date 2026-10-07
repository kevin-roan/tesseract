import { describe, expect, it } from "vitest";
import { GALLERY_ENTRIES } from "../app/registry/gallery";
import { GROUP_3_ENTRIES } from "./group-3";

describe("form control gallery entries", () => {
  it("are discovered by the gallery registry with unique ids", () => {
    const ids = GROUP_3_ENTRIES.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(GALLERY_ENTRIES.some((entry) => entry.id === id)).toBe(true);
  });
});
