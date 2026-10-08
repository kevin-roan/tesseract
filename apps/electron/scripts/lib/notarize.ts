export const NOTARIZE_ENV = {
  mode: "TESSERACT_NOTARIZE",
  apiKey: "APPLE_API_KEY",
  apiKeyId: "APPLE_API_KEY_ID",
  apiIssuer: "APPLE_API_ISSUER",
  appleId: "APPLE_ID",
  appleIdPassword: "APPLE_APP_SPECIFIC_PASSWORD",
  teamId: "APPLE_TEAM_ID",
  keychainProfile: "APPLE_KEYCHAIN_PROFILE",
  keychain: "APPLE_KEYCHAIN",
} as const;

export type NotarizeCredentials =
  | { appleApiKey: string; appleApiKeyId: string; appleApiIssuer: string }
  | { appleId: string; appleIdPassword: string; teamId: string }
  | { keychainProfile: string; keychain?: string };

export type NotarizePlan =
  | { notarize: true; method: "api-key" | "apple-id" | "keychain"; credentials: NotarizeCredentials }
  | { notarize: false; reason: string };

type Env = Readonly<Record<string, string | undefined>>;

const GROUPS = {
  "api-key": [NOTARIZE_ENV.apiKey, NOTARIZE_ENV.apiKeyId, NOTARIZE_ENV.apiIssuer],
  "apple-id": [NOTARIZE_ENV.appleId, NOTARIZE_ENV.appleIdPassword, NOTARIZE_ENV.teamId],
} as const;

function value(env: Env, name: string): string | null {
  const raw = env[name]?.trim();
  return raw ? raw : null;
}

function group(env: Env, names: readonly string[]): string[] | null {
  const values = names.map((name) => value(env, name));
  const present = values.filter((item): item is string => item !== null);
  if (present.length === 0) return null;
  if (present.length < names.length) {
    const missing = names.filter((_, index) => values[index] === null);
    throw new Error(`Notarization needs ${names.join(", ")}; missing ${missing.join(", ")}`);
  }
  return present;
}

export function planNotarization(env: Env, platform: string): NotarizePlan {
  if (platform !== "darwin") return { notarize: false, reason: `not a macOS build (${platform})` };
  const mode = value(env, NOTARIZE_ENV.mode);
  if (mode === "0" || mode === "false") return { notarize: false, reason: `${NOTARIZE_ENV.mode}=${mode}` };
  const apiKey = group(env, GROUPS["api-key"]);
  if (apiKey) {
    const [appleApiKey, appleApiKeyId, appleApiIssuer] = apiKey as [string, string, string];
    return { notarize: true, method: "api-key", credentials: { appleApiKey, appleApiKeyId, appleApiIssuer } };
  }
  const appleId = group(env, GROUPS["apple-id"]);
  if (appleId) {
    const [id, appleIdPassword, teamId] = appleId as [string, string, string];
    return { notarize: true, method: "apple-id", credentials: { appleId: id, appleIdPassword, teamId } };
  }
  const keychainProfile = value(env, NOTARIZE_ENV.keychainProfile);
  if (keychainProfile) {
    const keychain = value(env, NOTARIZE_ENV.keychain);
    return { notarize: true, method: "keychain", credentials: keychain ? { keychainProfile, keychain } : { keychainProfile } };
  }
  if (mode === "1" || mode === "true") {
    throw new Error(
      `${NOTARIZE_ENV.mode}=${mode} but no credentials: set ${GROUPS["api-key"].join(", ")} or ${GROUPS["apple-id"].join(", ")} or ${NOTARIZE_ENV.keychainProfile}`,
    );
  }
  return { notarize: false, reason: "no Apple notarization credentials in the environment" };
}
