import { useMemo, type ReactNode } from "react";
import type { ViewStyle } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type IslandShellProps = {
  frame: AnimatedStyle<ViewStyle>;
  clip: AnimatedStyle<ViewStyle>;
  children: ReactNode;
};

/** The near-black body of the island whose size, corners and position the morph animates. */
const IslandShell = ({ frame, clip, children }: IslandShellProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View style={[styles.shell, frame]} pointerEvents="box-none">
      <Animated.View style={[styles.clip, clip]} pointerEvents="box-none">
        <GestureHandlerRootView style={styles.fill}>{children}</GestureHandlerRootView>
      </Animated.View>
    </Animated.View>
  );
};

export default IslandShell;
