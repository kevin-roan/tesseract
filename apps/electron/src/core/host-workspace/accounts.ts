import { existsSync, statSync } from "node:fs";
import { parseClaudeAccounts } from "../sandbox/stack";

const PRIMARY_ACCOUNT_ID = "claude";

const isDirectory = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/**
 * `TESSERACT_CLAUDE_ACCOUNTS` for the host workspace controller: the same extra accounts the sandbox mounts
 * (`TESSERACT_HOST_CLAUDE_ACCOUNTS`), as `name=/abs/path`, skipping missing dirs and invalid entries.
 */
export function workspaceAccounts(raw: string | undefined, home: string, exists: (path: string) => boolean = isDirectory): string {
  try {
    return parseClaudeAccounts(raw ?? "", home)
      .filter((account) => exists(account.path))
      .map((account) => `${account.name}=${account.path}`)
      .join(",");
  } catch {
    return "";
  }
}

/** Account ids the controller derives from that value: `claude` plus `claude-<name>` each. */
export function workspaceAccountIds(accounts: string): string[] {
  const names = accounts
    .split(",")
    .filter(Boolean)
    .map((entry) => entry.split("=")[0] ?? entry);
  return [PRIMARY_ACCOUNT_ID, ...names.map((name) => `${PRIMARY_ACCOUNT_ID}-${name}`)];
}
