import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";

import { channelLabel } from "../utils/about";
import { ABOUT_COPY } from "../utils/constants";
import { useAppInfo } from "./use-app-info";

export function useAboutEntry() {
  const nav = useSandboxNavigation();
  const info = useAppInfo();
  return {
    title: ABOUT_COPY.entryTitle,
    subtitle: ABOUT_COPY.entrySubtitle(info.version ?? ABOUT_COPY.unknown, channelLabel(info.channel)),
    open: nav.about,
  };
}
