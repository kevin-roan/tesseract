import { afterEach, describe, expect, it } from "vitest";
import { artifact } from "./test-data";
import { filesStore, resetFilesStore, scopedData, useFilesStore } from "./store";

const ARTIFACT = artifact("a");

describe("files store", () => {
  afterEach(resetFilesStore);

  it("scopes data to the sandbox it came from", () => {
    filesStore.setArtifacts("http://a", [ARTIFACT]);
    expect(scopedData(useFilesStore.getState(), "http://a").artifacts).toEqual([ARTIFACT]);
    expect(scopedData(useFilesStore.getState(), "http://b").artifacts).toBeNull();
    filesStore.setOutputsError("http://b", "offline");
    expect(scopedData(useFilesStore.getState(), "http://a").artifacts).toBeNull();
    expect(scopedData(useFilesStore.getState(), "http://b").outputsError).toBe("offline");
  });

  it("tracks a download once and reports progress", () => {
    expect(filesStore.claimDownload("a")).toBe(true);
    expect(filesStore.claimDownload("a")).toBe(false);
    filesStore.setProgress("a", 0.5);
    expect(useFilesStore.getState().downloads).toEqual({});
    filesStore.startDownload("a");
    filesStore.setProgress("a", 0.5);
    expect(useFilesStore.getState().downloads).toEqual({ a: 0.5 });
    filesStore.finishDownload("a");
    expect(useFilesStore.getState().downloads).toEqual({});
    expect(filesStore.claimDownload("a")).toBe(true);
  });

  it("handles a navigation entry at most once", () => {
    expect(filesStore.claimNavigation(1)).toBe(true);
    expect(filesStore.claimNavigation(1)).toBe(false);
    expect(filesStore.claimNavigation(2)).toBe(true);
  });
});
