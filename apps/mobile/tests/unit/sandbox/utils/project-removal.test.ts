import { sampleSyncChanges } from "@tesseract/protocol/fixtures";

import { projectRemovalPrompt } from "@/features/sandbox/utils/project-removal";

describe("projectRemovalPrompt", () => {
  it("asks for a force delete and lists the files not synced back to the host", () => {
    const prompt = projectRemovalPrompt("electron-hello", sampleSyncChanges);
    expect(prompt.force).toBe(true);
    expect(prompt.confirmLabel).toBe("Force delete");
    expect(prompt.message).toContain("3 files in electron-hello changed in the sandbox and are not synced back to workstation");
    expect(prompt.message).toContain("src/main.ts");
  });

  it("asks for a force delete when the sandbox has the only copy", () => {
    const prompt = projectRemovalPrompt("scratch", { ...sampleSyncChanges, baselineAt: null, changes: [], host: null });
    expect(prompt.force).toBe(true);
    expect(prompt.message).toContain("never synced from a computer");
  });

  it("plainly deletes a project the host is in sync with", () => {
    const prompt = projectRemovalPrompt("electron-hello", { ...sampleSyncChanges, changes: [], totalBytes: 0 });
    expect(prompt).toMatchObject({ title: "Delete electron-hello?", confirmLabel: "Delete", force: false });
    expect(prompt.message).toContain("The project on workstation is not touched");
  });
});
