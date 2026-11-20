import { useSettings, useUpdateSettings } from "../../app/settings";

export function useSidebarVisibility() {
  const { sidebarHidden } = useSettings();
  const update = useUpdateSettings();
  return {
    hidden: sidebarHidden,
    hide: () => update.mutate({ sidebarHidden: true }),
    show: () => update.mutate({ sidebarHidden: false }),
  };
}
