import { useSettingsStore } from "../store/settings-store";

export const useSttProvider = () => useSettingsStore((state) => state.sttProvider);

export const useSetSttProvider = () => useSettingsStore((state) => state.setSttProvider);
