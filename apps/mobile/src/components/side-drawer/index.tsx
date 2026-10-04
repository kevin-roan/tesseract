import { useMemo, type ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets, type Edge } from "react-native-safe-area-context";

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
  const insets = useSafeAreaInsets();
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
            {/* Hook insets, not SafeAreaView: the panel starts translated off-screen, so the native view measures zero. */}
            <View
              style={[
                styles.content,
                {
                  paddingTop: edges.includes("top") ? insets.top : 0,
                  paddingBottom: edges.includes("bottom") ? insets.bottom : 0,
                  paddingLeft: edges.includes("left") ? insets.left : 0,
                  paddingRight: edges.includes("right") ? insets.right : 0,
                },
              ]}
            >
              {children}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default SideDrawer;
