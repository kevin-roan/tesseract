import { sampleArtifact } from "@tesseract/protocol/fixtures";
import { describe, expect, it } from "vitest";
import { artifactsView } from "./model";

describe("artifactsView", () => {
  it("maps the list to loading, empty or content", () => {
    expect(artifactsView(null)).toBe("loading");
    expect(artifactsView([])).toBe("empty");
    expect(artifactsView([sampleArtifact])).toBe("content");
  });
});
