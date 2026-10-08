import { useMemo } from "react";
import { View } from "react-native";
import { AppWindowIcon, SkullIcon, XIcon } from "phosphor-react-native";
import type { DisplayWindow } from "@tesseract/protocol";

import IconButton from "@/components/icon-button";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import { windowDetail, windowTitle } from "../../utils/windows";
import createStyles from "./styles";

export type DisplayWindowRowProps = {
  window: DisplayWindow;
  busy: boolean;
  onActivate: (window: DisplayWindow) => void;
  onClose: (window: DisplayWindow) => void;
  onForceQuit: (window: DisplayWindow) => void;
};

const DisplayWindowRow = ({ window, busy, onActivate, onClose, onForceQuit }: DisplayWindowRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const title = windowTitle(window);
  const detail = windowDetail(window);

  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Bring ${title} to the front`}
        accessibilityState={{ selected: window.active, disabled: busy }}
        disabled={busy}
        onPress={() => onActivate(window)}
        style={styles.main}
      >
        <AppWindowIcon
          size={IconSize.md}
          color={window.active ? theme.colors.text : theme.colors.textSecondary}
          weight={window.active ? "fill" : "regular"}
        />
        <View style={styles.text}>
          <ThemedText variant="body" numberOfLines={1} color={window.minimized ? "textSecondary" : undefined}>
            {title}
          </ThemedText>
          {detail ? (
            <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
              {detail}
            </ThemedText>
          ) : null}
        </View>
      </PressableScale>
      <IconButton icon={SkullIcon} label={`Force quit ${title}`} tone="danger" disabled={busy} onPress={() => onForceQuit(window)} />
      <IconButton icon={XIcon} label={`Close ${title}`} disabled={busy} onPress={() => onClose(window)} />
    </View>
  );
};

export default DisplayWindowRow;
