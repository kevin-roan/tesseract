import { useMemo, type ReactNode } from "react";
import { Modal, Pressable } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";
import { useSideDrawer } from "./use-side-drawer";

export type SideDrawerProps = {
  visible: boolean;
  onClose: () => void;
  onClosed?: () => void;
  children: ReactNode;
  closeLabel?: string;
  edges?: Edge[];
  testID?: string;
};

const SideDrawer = ({
  visible,
  onClose,
  onClosed,
  children,
  closeLabel = "Close menu",
  edges = ["top", "bottom", "left"],
  testID,
}: SideDrawerProps) => {
  const theme = useAppTheme();
  const drawer = useSideDrawer(visible, onClose, onClosed);
  const styles = useMemo(() => createStyles(theme, drawer.width), [theme, drawer.width]);

  return (
    <Modal
      visible={drawer.mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.scrim, drawer.scrimStyle]}>
          <Pressable style={styles.scrimTouch} onPress={onClose} accessibilityRole="button" accessibilityLabel={closeLabel} />
        </Animated.View>
        <GestureDetector gesture={drawer.pan}>
          <Animated.View style={[styles.panel, drawer.panelStyle]} accessibilityViewIsModal testID={testID}>
            <SafeAreaView edges={edges} style={styles.content}>
              {children}
            </SafeAreaView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default SideDrawer;
