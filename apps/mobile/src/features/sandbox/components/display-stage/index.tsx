import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { EdgeInsets } from "react-native-safe-area-context";

import { GlassButton } from "@/components/glass";
import GlassToolbar, { type GlassToolbarAction, type GlassToolbarProps } from "@/components/glass-toolbar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type DisplayStageProps = {
  children: ReactNode;
  toolbar: Omit<GlassToolbarProps, "style">;
  fullscreen: boolean;
  exitFullscreen: GlassToolbarAction;
  safeArea: EdgeInsets;
};

/** Full-bleed stage with a floating glass bar, or only a small exit button in full screen. */
const DisplayStage = ({ children, toolbar, fullscreen, exitFullscreen, safeArea }: DisplayStageProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, safeArea), [theme, safeArea]);
  const { icon: ExitIcon } = exitFullscreen;

  return (
    <View style={styles.root}>
      <StatusBar hidden={fullscreen} animated />
      {children}
      {fullscreen ? (
        // GlassButton styles its inner glass, not its Pressable, so the placement lives on a wrapper.
        <View style={styles.exit}>
          <GlassButton
            accessibilityLabel={exitFullscreen.label}
            onPress={exitFullscreen.onPress}
            intensity="heavy"
            style={styles.exitButton}
          >
            <ExitIcon size={IconSize.md} color={theme.colors.text} weight="bold" />
          </GlassButton>
        </View>
      ) : (
        <GlassToolbar {...toolbar} style={styles.bar} />
      )}
    </View>
  );
};

export default DisplayStage;
