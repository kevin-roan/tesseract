import { useSandboxNavigation } from "@/features/sandbox/hooks/use-sandbox-navigation";
import { useSandboxRefresh } from "@/features/sandbox/hooks/use-sandbox-refresh";

import { useSttSettings } from "./use-stt-settings";

export function useVoiceScreen() {
  const nav = useSandboxNavigation();
  const stt = useSttSettings();
  const { refreshing, refresh } = useSandboxRefresh();
  return { back: nav.back, stt, refreshing, refresh };
}
