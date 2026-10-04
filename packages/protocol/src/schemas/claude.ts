import { z } from "zod";
import { CLAUDE_ACCOUNT_ID_PATTERN, CLAUDE_AUTH_METHODS, LIMITS } from "../constants";

export const ClaudeAuthMethodSchema = z.enum(CLAUDE_AUTH_METHODS);
export type ClaudeAuthMethod = z.infer<typeof ClaudeAuthMethodSchema>;

export const ClaudeAccountSchema = z.object({
  email: z.string().nullable(),
  displayName: z.string().nullable(),
  organization: z.string().nullable(),
});
export type ClaudeAccount = z.infer<typeof ClaudeAccountSchema>;

/** `GET /v1/claude/auth`. Never contains a secret. */
export const ClaudeAuthStatusSchema = z.object({
  /** The `claude` executable was found. */
  available: z.boolean(),
  /** Credential the sandbox's Claude Code will use (first present of: oauth_token, credentials, api_key). */
  method: ClaudeAuthMethodSchema,
  loggedIn: z.boolean(),
  sources: z.object({
    /** `CLAUDE_CODE_OAUTH_TOKEN` is set in the controller's environment. */
    oauthToken: z.boolean(),
    /** `$CLAUDE_CONFIG_DIR/.credentials.json` holds a `claudeAiOauth` login. */
    credentials: z.boolean(),
    apiKey: z.boolean(),
  }),
  /** The oauth token came from the environment (always equals `sources.oauthToken`). */
  oauthTokenFromEnv: z.boolean(),
  account: ClaudeAccountSchema.nullable(),
  subscriptionType: z.string().nullable(),
  /** Access-token expiry of the credentials login (ISO); refreshed by Claude Code itself. */
  credentialsExpiresAt: z.string().nullable(),
  settingsPresent: z.boolean(),
  configDir: z.string(),
  /** Last `POST /v1/claude/import` (ISO) or null. */
  importedAt: z.string().nullable(),
});
export type ClaudeAuthStatus = z.infer<typeof ClaudeAuthStatusSchema>;

/** The `claudeAiOauth` object of `~/.claude/.credentials.json`, extra fields kept. */
export const ClaudeOauthCredentialsSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1).optional(),
    expiresAt: z.number().optional(),
    scopes: z.array(z.string()).optional(),
    subscriptionType: z.string().nullable().optional(),
  })
  .loose();
export type ClaudeOauthCredentials = z.infer<typeof ClaudeOauthCredentialsSchema>;

/** A file relative to `$CLAUDE_CONFIG_DIR`; the controller only accepts `CLAUDE_IMPORT_PATHS`. */
export const ClaudeImportFileSchema = z.object({
  path: z.string().min(1).max(512),
  content: z.string().max(LIMITS.maxClaudeImportFileBytes),
});
export type ClaudeImportFile = z.infer<typeof ClaudeImportFileSchema>;

/**
 * `POST /v1/claude/import`: host → sandbox copy, sent by the desktop app. Every part is optional.
 * `account` is a subset of the host `~/.claude.json`; only `CLAUDE_IMPORT_ACCOUNT_KEYS` are merged.
 */
export const ClaudeImportSchema = z.object({
  credentials: ClaudeOauthCredentialsSchema.optional(),
  account: z.record(z.string(), z.unknown()).optional(),
  files: z.array(ClaudeImportFileSchema).max(LIMITS.maxClaudeImportFiles).optional(),
});
export type ClaudeImport = z.infer<typeof ClaudeImportSchema>;

export const ClaudeImportResultSchema = z.object({
  status: ClaudeAuthStatusSchema,
  written: z.array(z.string()),
  skipped: z.array(z.object({ path: z.string(), reason: z.string() })),
});
export type ClaudeImportResult = z.infer<typeof ClaudeImportResultSchema>;

export const ClaudeAccountIdSchema = z.string().regex(CLAUDE_ACCOUNT_ID_PATTERN, "Invalid Claude account id");
export type ClaudeAccountId = z.infer<typeof ClaudeAccountIdSchema>;

/** One Claude Code config dir linked from the host (`~/.claude` or `~/.claude-<name>`). Never contains a secret. */
export const ClaudeAccountProfileSchema = z.object({
  /** `claude` for the host's `~/.claude`, `claude-<name>` for `~/.claude-<name>` (the host alias name). */
  id: ClaudeAccountIdSchema,
  primary: z.boolean(),
  /** The config dir is mounted in the sandbox. */
  present: z.boolean(),
  loggedIn: z.boolean(),
  account: ClaudeAccountSchema.nullable(),
  subscriptionType: z.string().nullable(),
  credentialsExpiresAt: z.string().nullable(),
  settingsPresent: z.boolean(),
  configDir: z.string(),
});
export type ClaudeAccountProfile = z.infer<typeof ClaudeAccountProfileSchema>;

/** `GET /v1/claude/accounts`. */
export const ClaudeAccountListSchema = z.object({
  defaultAccountId: ClaudeAccountIdSchema,
  accounts: z.array(ClaudeAccountProfileSchema),
});
export type ClaudeAccountList = z.infer<typeof ClaudeAccountListSchema>;

/** `PUT /v1/claude/accounts/default`. */
export const SetDefaultClaudeAccountSchema = z.object({ accountId: ClaudeAccountIdSchema });
export type SetDefaultClaudeAccount = z.infer<typeof SetDefaultClaudeAccountSchema>;

/** `PUT /v1/projects/:id/claude-account`: null follows the default account. */
export const SetProjectClaudeAccountSchema = z.object({ accountId: ClaudeAccountIdSchema.nullable() });
export type SetProjectClaudeAccount = z.infer<typeof SetProjectClaudeAccountSchema>;
