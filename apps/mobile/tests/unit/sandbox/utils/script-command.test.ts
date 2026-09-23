import { execFileSync } from "node:child_process";

import { scriptCommand } from "@/features/sandbox/utils/projects";

const argsSeenByBash = (command: string): string[] =>
  execFileSync("bash", ["-c", `npm() { printf '%s\\0' "$@"; }; ${command}`], { encoding: "utf8" })
    .split("\0")
    .slice(0, -1);

describe("scriptCommand", () => {
  it("leaves ordinary script names readable", () => {
    expect(scriptCommand("npm", "build:win")).toBe("npm run build:win");
    expect(scriptCommand("pnpm", "@scope/dev")).toBe("pnpm run @scope/dev");
    expect(scriptCommand(null, "test-e2e")).toBe("npm run test-e2e");
  });

  it.each(["test unit", "lint && echo pwned", "build$(id)", "it's", "a;b", "`id`", "x\ny", "*"])(
    "passes %p to the package manager as one argument under bash -lc",
    (script) => {
      const command = scriptCommand("npm", script);
      expect(command).not.toBe(`npm run ${script}`);
      expect(argsSeenByBash(command)).toEqual(["run", script]);
    },
  );
});
