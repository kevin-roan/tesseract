import { resolve } from "node:path";
import { TheOneClient } from "@theone/client";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set: run the suite through infra/e2e/run`);
  return value;
}

export const REPO_ROOT = resolve(import.meta.dir, "../../..");

export const e2e = {
  url: required("THEONE_E2E_URL"),
  token: required("THEONE_E2E_TOKEN"),
  project: required("THEONE_E2E_PROJECT"),
  envFile: required("THEONE_E2E_ENV_FILE"),
  vncPort: Number(required("THEONE_E2E_VNC_PORT")),
  vncPassword: required("THEONE_E2E_VNC_PASSWORD"),
} as const;

export const SECONDS = 1_000;
export const MINUTES = 60 * SECONDS;

export function createClient(token: string = e2e.token): TheOneClient {
  return new TheOneClient({ baseUrl: e2e.url, token, timeoutMs: 60 * SECONDS });
}

export const client = createClient();
