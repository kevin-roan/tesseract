import type { DefineContract } from "../ipc-types";

export type HostClaudeLogin = "signed-in" | "missing" | "invalid" | "keychain";

export interface HostClaudeSettings {
  settingsJson: boolean;
  claudeMd: boolean;
  skills: number;
  agents: number;
  commands: number;
  outputStyles: number;
}

export interface HostClaudeState {
  id: string;
  configDir: string;
  primary: boolean;
  login: HostClaudeLogin;
  email: string | null;
  displayName: string | null;
  organization: string | null;
  subscriptionType: string | null;
  expiresAt: number | null;
  settings: HostClaudeSettings;
}

export type ClaudeContract = DefineContract<{
  methods: {
    hostAccounts(): HostClaudeState[];
    ensureConfigDir(): { path: string; created: boolean };
  };
  events: Record<never, never>;
}>;
