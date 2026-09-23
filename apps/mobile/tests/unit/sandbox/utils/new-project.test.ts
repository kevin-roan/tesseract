import { LIMITS } from "@theone/protocol";

import {
  EMPTY_PROJECT_DRAFT,
  cloneBadge,
  cloneFailureMessage,
  createProjectLabel,
  projectLocationHint,
  validateProjectDraft,
} from "@/features/sandbox/utils/new-project";

const draft = (values: Partial<typeof EMPTY_PROJECT_DRAFT>) => ({ ...EMPTY_PROJECT_DRAFT, ...values });

describe("validateProjectDraft", () => {
  it("builds the CreateProject body from trimmed fields and returns the resulting id", () => {
    expect(validateProjectDraft(draft({ name: "  My App " }))).toEqual({ ok: true, projectId: "my-app", value: { name: "My App" } });
    expect(
      validateProjectDraft(draft({ name: "api", gitUrl: " git@github.com:me/api.git ", branch: " release/1.2 " })),
    ).toEqual({
      ok: true,
      projectId: "api",
      value: { name: "api", gitUrl: "git@github.com:me/api.git", branch: "release/1.2" },
    });
  });

  it("rejects names that are empty, too long, symbol-only or already taken", () => {
    const errorFor = (name: string, existing: string[] = []) => {
      const result = validateProjectDraft(draft({ name }), existing);
      return result.ok ? null : result.errors.name;
    };
    expect(errorFor("   ")).toBe("Enter a project name.");
    expect(errorFor("x".repeat(LIMITS.maxNameLength + 1))).toMatch(/under 128/);
    expect(errorFor("!!!")).toBe("Use at least one letter or digit.");
    expect(errorFor("Notes", ["notes"])).toBe("/workspace/projects/notes already exists.");
    expect(errorFor("notes", ["other"])).toBeNull();
  });

  it("checks git URLs and branches the way the controller does", () => {
    const errors = (values: Partial<typeof EMPTY_PROJECT_DRAFT>) => {
      const result = validateProjectDraft(draft({ name: "demo", ...values }));
      return result.ok ? {} : result.errors;
    };
    expect(errors({ gitUrl: "github.com/me/repo" }).gitUrl).toMatch(/https:\/\//);
    expect(errors({ gitUrl: `https://example.com/${"a".repeat(2048)}` }).gitUrl).toBeDefined();
    expect(errors({ gitUrl: "ssh://git@example.com/repo.git" })).toEqual({});
    expect(errors({ branch: "main" }).branch).toMatch(/only applies when cloning/);
    expect(errors({ gitUrl: "https://example.com/r.git", branch: "../escape" }).branch).toBe("That is not a valid branch name.");
    expect(errors({ gitUrl: "https://example.com/r.git", branch: "-bad" }).branch).toBeDefined();
  });

  it("drops a blank branch instead of sending it", () => {
    const result = validateProjectDraft(draft({ name: "demo", gitUrl: "https://example.com/r.git", branch: "  " }));
    expect(result).toEqual({ ok: true, projectId: "demo", value: { name: "demo", gitUrl: "https://example.com/r.git" } });
  });
});

describe("new project copy", () => {
  it("describes where the project lands and what the button does", () => {
    expect(projectLocationHint("Hello World")).toBe("Created as /workspace/projects/hello-world");
    expect(projectLocationHint("")).toBe("Becomes a folder in /workspace/projects.");
    expect(createProjectLabel(draft({ name: "a" }))).toBe("Create project");
    expect(createProjectLabel(draft({ name: "a", gitUrl: " https://x.dev/r.git" }))).toBe("Clone project");
  });

  it("labels the clone by its exit code", () => {
    expect(cloneBadge(undefined)).toEqual({ label: "Cloning", tone: "info" });
    expect(cloneBadge(0)).toEqual({ label: "Cloned", tone: "success" });
    expect(cloneBadge(128)).toEqual({ label: "Failed", tone: "danger" });
    expect(cloneBadge(null)).toEqual({ label: "Failed", tone: "danger" });
    expect(cloneFailureMessage(128)).toMatch(/^git exited with code 128\./);
    expect(cloneFailureMessage(null)).toMatch(/^git stopped before it finished\./);
  });
});
