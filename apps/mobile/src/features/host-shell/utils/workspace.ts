import type { HostWorkspaceAccess } from "@tesseract/protocol";

import type { PairedSandbox } from "@/features/sandbox/types";

export const folderName = (path: string): string => path.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) || path;

export function gitSummary(output: string, fallback: string): string {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.at(-1) ?? fallback;
}

/** Whether the paired entry already points at this workspace controller with this token. */
export const isSameWorkspace = (sandbox: PairedSandbox | undefined, token: string | undefined, access: HostWorkspaceAccess): boolean =>
  sandbox?.baseUrl === access.url && token === access.token;
