import { playHaptic } from "@/lib/haptics";

type TabListenerProps = { navigation: { isFocused: () => boolean } };

/** `tabPress` fires before the jump, so the pressed tab is still unfocused unless it was reselected. */
export const selectionHapticListeners = ({ navigation }: TabListenerProps) => ({
  tabPress: () => {
    if (!navigation.isFocused()) playHaptic("selection");
  },
});
