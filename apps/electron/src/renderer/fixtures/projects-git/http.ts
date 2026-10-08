import { routePatterns } from "@tesseract/protocol";
import { GTK_PARITY, parityGitFiles } from "../projects/parity";
import { currentScenario, isScenario } from "../scenario";
import { defineHttpFixtures, reply } from "../types";
import { FIXTURE_GIT, FIXTURE_GIT_FALLBACK } from "./data";

export const SCENARIOS = {
  gitError: "git-error",
} as const;

export default defineHttpFixtures([
  {
    method: "GET",
    path: routePatterns.rest.projectGit,
    respond: ({ params }) => {
      if (currentScenario() === SCENARIOS.gitError) return reply(500, { error: { code: "internal", message: "git status timed out" } });
      const id = params[0] ?? "";
      if (isScenario(GTK_PARITY) && !FIXTURE_GIT[id]) return { ...FIXTURE_GIT_FALLBACK, files: parityGitFiles(id) };
      return FIXTURE_GIT[id] ?? FIXTURE_GIT_FALLBACK;
    },
  },
]);
