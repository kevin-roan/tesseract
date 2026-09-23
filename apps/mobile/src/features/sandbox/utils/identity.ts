import { SANDBOX_ID_PREFIX, TOKEN_KEY_PREFIX, TOKEN_KEY_SUFFIX } from "./constants";

const RANDOM_SPAN = 36 ** 6;

export function createSandboxId(now: number = Date.now(), random: () => number = Math.random): string {
  const suffix = Math.floor(random() * RANDOM_SPAN)
    .toString(36)
    .padStart(6, "0");
  return `${SANDBOX_ID_PREFIX}${now.toString(36)}${suffix}`;
}

export function tokenStorageKey(sandboxId: string): string {
  return `${TOKEN_KEY_PREFIX}${sandboxId.replace(/[^A-Za-z0-9._-]/g, "_")}${TOKEN_KEY_SUFFIX}`;
}
