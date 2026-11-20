import type { PreferencesSectionId } from "../../../shared/routes";

export const ACCOUNT_KEYS = {
  state: ["account", "state"] as const,
  devices: ["account", "devices"] as const,
};
export const TAILNET_STATE_KEY = ["tailnet", "state"] as const;
export const ACCOUNT_SECTION: PreferencesSectionId = "account";
