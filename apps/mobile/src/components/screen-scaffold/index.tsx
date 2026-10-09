import { useContext, useMemo, type ReactNode } from "react";
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { SafeAreaInsetsContext, SafeAreaView, type Edge } from "react-native-safe-area-context";

import DotGrid from "@/components/dot-grid";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";

import createStyles from "./styles";

export type ScreenScaffoldProps = {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  avoidKeyboard?: boolean;
  /** Safe-area edges to pad. Defaults to all four. */
  edges?: readonly Edge[];
  /** Draw the graphite dot grid behind the screen. */
  dotGrid?: boolean;
  testID?: string;
};

const ScreenScaffold = ({
  children,
  header,
  footer,
  scroll = true,
  refreshing = false,
  onRefresh,
  avoidKeyboard = false,
  edges,
  dotGrid = true,
  testID,
}: ScreenScaffoldProps) => {
  const theme = useAppTheme();
  const insets = useContext(SafeAreaInsetsContext);
  const keyboardHeight = useKeyboardHeight(avoidKeyboard);
  // The tab bar sits under the keyboard while it is up, so its inset is only reserved when the keyboard is down.
  const tabBarInset = useTabBarInset();
  const bottomInset = keyboardHeight > 0 ? 0 : tabBarInset;
  const safeBottom = !edges || edges.includes("bottom") ? (insets?.bottom ?? 0) : 0;
  const keyboardInset = Math.max(keyboardHeight - safeBottom, 0);
  const styles = useMemo(() => createStyles(theme, bottomInset, !!footer), [theme, bottomInset, footer]);
  const headerEntrance = useEntrance(0);

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.textSecondary} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    // Tapping empty space dismisses the keyboard, as the ScrollView's "handled" taps do; children's own presses win.
    <Pressable style={[styles.fill, styles.body]} onPress={Keyboard.dismiss} accessible={false}>
      {children}
    </Pressable>
  );

  return (
    <View style={styles.root} testID={testID}>
      {dotGrid && theme.look === "graphite" ? <DotGrid /> : null}
      <SafeAreaView style={styles.fill} edges={edges}>
        {/* iOS pads by the keyboard's own height; KeyboardAvoidingView over-pads inside the tab navigator there.
            The padding sits on an inner view because a disabled KeyboardAvoidingView still forces paddingBottom: 0. */}
        <KeyboardAvoidingView style={styles.fill} behavior="padding" enabled={avoidKeyboard && Platform.OS !== "ios"}>
          <View style={[styles.fill, { paddingBottom: keyboardInset }]}>
            {header ? (
              <Animated.View entering={headerEntrance} style={styles.header}>
                {header}
              </Animated.View>
            ) : null}
            {body}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default ScreenScaffold;
