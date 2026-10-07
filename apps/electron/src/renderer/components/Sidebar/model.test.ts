import { describe, expect, it } from "vitest";
import { countLabel, EMPTY_EXPANSION, isExpanded, runTitle, runTone, toggleExpansion, withActiveProjects, workspaceState } from "./model";

describe("sidebar model", () => {
  it("titles runs from the first non-blank prompt line", () => {
    expect(runTitle("\n  \n  Fix the build  \nmore", "Untitled")).toBe("Fix the build");
    expect(runTitle("   ", "Untitled")).toBe("Untitled");
    expect(runTitle(null, "Untitled")).toBe("Untitled");
    expect(runTitle("x".repeat(100), "Untitled")).toBe(`${"x".repeat(80)}…`);
  });

  it("maps run states to tones", () => {
    expect(runTone("running")).toBe("info");
    expect(runTone("succeeded")).toBe("success");
    expect(runTone("failed")).toBe("danger");
    expect(runTone("cancelled")).toBe("neutral");
    expect(runTone("queued")).toBe("neutral");
  });

  it("formats counts like CountBadge", () => {
    expect(countLabel(0)).toBeNull();
    expect(countLabel(null)).toBeNull();
    expect(countLabel(7)).toBe("7");
    expect(countLabel(100)).toBe("99+");
  });

  it("derives the projects state", () => {
    expect(workspaceState(true, false, 0)).toBe("loading");
    expect(workspaceState(false, false, 0)).toBe("offline");
    expect(workspaceState(false, true, 0)).toBe("offline");
    expect(workspaceState(true, true, 0)).toBe("empty");
    expect(workspaceState(false, true, 2)).toBe("ready");
  });

  it("expands active projects until the user toggles them", () => {
    let state = withActiveProjects(EMPTY_EXPANSION, [
      { id: "a", running: 1 },
      { id: "b", running: 0 },
    ]);
    expect(isExpanded(state, "a")).toBe(true);
    expect(isExpanded(state, "b")).toBe(false);
    state = toggleExpansion(state, "a");
    expect(isExpanded(state, "a")).toBe(false);
    state = withActiveProjects(state, [{ id: "a", running: 2 }, { id: "b", running: 1 }]);
    expect(isExpanded(state, "a")).toBe(false);
    expect(isExpanded(state, "b")).toBe(true);
    state = withActiveProjects(state, [{ id: "b", running: 0 }]);
    expect(isExpanded(state, "b")).toBe(true);
    expect(withActiveProjects(state, [{ id: "b", running: 1 }])).toBe(state);
    state = toggleExpansion(state, null);
    expect(isExpanded(state, null)).toBe(true);
  });
});
