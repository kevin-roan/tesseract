import type { IconName } from "../../../../theme/icons";
import type { HostRepoAction } from "./model";

export const HOST_REPO_ICONS: Record<HostRepoAction, IconName> = { shell: "host", pull: "down", push: "send" };
export const HOST_LINKS_KEY = ["syncback", "links"] as const;
export const HOST_REPO_ACTIONS: readonly HostRepoAction[] = ["shell", "pull", "push"];
