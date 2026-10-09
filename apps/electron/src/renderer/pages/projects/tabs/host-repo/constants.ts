import type { HostGitAction } from "../../../../../shared/contracts/syncback";
import type { IconName } from "../../../../theme/icons";
import type { HostRepoAction } from "./model";

export const HOST_REPO_ICONS: Record<HostRepoAction, IconName> = { shell: "host", pull: "down", push: "send", commit: "commit" };
export const HOST_GIT_ICON: IconName = "branch";
export const HOST_LINKS_KEY = ["syncback", "links"] as const;
export const HOST_GIT_SYNC_ACTIONS: readonly HostGitAction[] = ["pull", "push"];
