import type { HostGitAction } from "../../../../../shared/contracts/syncback";
import type { IconName } from "../../../../theme/icons";
import type { HostRepoAction } from "./model";

export const HOST_REPO_ICONS: Record<HostRepoAction, IconName> = { claude: "agents", shell: "host", pull: "down", push: "send", commit: "commit" };
export const HOST_GROUP_ICON: IconName = "host";
export const HOST_GIT_ICON: IconName = "branch";
export const HOST_LINKS_KEY = ["syncback", "links"] as const;
export const HOST_GIT_SYNC_ACTIONS: readonly HostGitAction[] = ["pull", "push"];
export const HOST_CHAT_RUNS_KEY = ["host-chat", "runs"] as const;
export const HOST_CHAT_PROJECT_KEY = ["host-chat", "project"] as const;
export const HOST_CHAT_ACCOUNTS_KEY = ["host-chat", "accounts"] as const;
export const HOST_CHAT_REFRESH_MS = 5_000;
export const HOST_CHAT_WIDTH = 860;
