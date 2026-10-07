import { homedir } from "node:os";
import { ensureClaudeDir, readHostClaudeStates } from "../../core/claude";
import { defineService } from "./_framework/define";

function environment() {
  return { home: homedir(), env: process.env, platform: process.platform };
}

export default defineService("claude", {
  hostAccounts: () => readHostClaudeStates(environment()),
  ensureConfigDir: () => ensureClaudeDir(environment()),
});
