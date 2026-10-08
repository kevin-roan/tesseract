import { PROJECT_ID_MAX_LENGTH } from "@tesseract/protocol";

import { projectNameCandidate, projectNameFromPrompt } from "@/features/chat/utils/project-name";

describe("projectNameFromPrompt", () => {
  it("slugs the first words of the prompt", () => {
    expect(projectNameFromPrompt("  Where is it running ?  ")).toBe("where-is-it-running");
    expect(projectNameFromPrompt("Build a todo app with auth and a dark mode")).toBe("build-a-todo-app-with-auth");
  });

  it("falls back when the prompt has no usable characters", () => {
    expect(projectNameFromPrompt("🙂 ???")).toBe("chat");
  });
});

describe("projectNameCandidate", () => {
  it("adds a numeric suffix after the first attempt and keeps it within the id limit", () => {
    expect(projectNameCandidate("todo", 1)).toBe("todo");
    expect(projectNameCandidate("todo", 3)).toBe("todo-3");
    const long = projectNameCandidate("a".repeat(PROJECT_ID_MAX_LENGTH), 12);
    expect(long).toHaveLength(PROJECT_ID_MAX_LENGTH);
    expect(long.endsWith("-12")).toBe(true);
  });
});
