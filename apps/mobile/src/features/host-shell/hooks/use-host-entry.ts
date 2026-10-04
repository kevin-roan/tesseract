import { PROFILE_ENTRY } from "../utils/content";
import { useHostClient } from "./use-host-client";
import { useHostNavigation } from "./use-host-navigation";

export function useHostEntry() {
  const { host } = useHostClient();
  const nav = useHostNavigation();
  return {
    title: PROFILE_ENTRY.title,
    subtitle: host ? PROFILE_ENTRY.paired(host.name) : PROFILE_ENTRY.unpaired,
    open: nav.open,
  };
}
