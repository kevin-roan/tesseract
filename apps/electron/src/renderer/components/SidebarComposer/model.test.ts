import { describe, expect, it } from "vitest";
import { canSendFromSidebar, pickerChoices, pickerOptions, resolveSelection, sortProjects } from "./model";

const projects = [{ id: "zeta", name: "Zeta" }, { id: "b-id", name: null }, { id: "alpha", name: "alpha" }];

describe("project picker model", () => {
  it("sorts case-insensitively by name, falling back to id", () => {
    expect(sortProjects(projects).map((p) => p.id)).toEqual(["alpha", "b-id", "zeta"]);
  });

  it("starts with No project", () => {
    expect(pickerOptions(projects, "No project")[0]).toEqual({ id: null, label: "No project" });
    expect(pickerOptions(projects, "No project").map((o) => o.label)).toEqual(["No project", "alpha", "b-id", "Zeta"]);
    expect(pickerChoices(projects, "No project")[0]).toEqual({ id: "", label: "No project" });
  });

  it("falls back to No project when the selection disappears", () => {
    expect(resolveSelection(projects, "alpha")).toBe("alpha");
    expect(resolveSelection(projects, "gone")).toBeNull();
    expect(resolveSelection(projects, null)).toBeNull();
  });
});

describe("canSendFromSidebar", () => {
  it("requires content, online and unblocked attachments", () => {
    expect(canSendFromSidebar({ text: "hi", online: true })).toBe(true);
    expect(canSendFromSidebar({ text: "hi", online: false })).toBe(false);
    expect(canSendFromSidebar({ text: " ", online: true })).toBe(false);
    expect(canSendFromSidebar({ text: "", online: true, hasAttachments: true })).toBe(true);
    expect(canSendFromSidebar({ text: "hi", online: true, attachmentsBlocked: true })).toBe(false);
  });
});
