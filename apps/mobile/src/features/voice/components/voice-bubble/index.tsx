import { memo, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { PauseIcon, PlayIcon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import Waveform from "@/components/waveform";
import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type VoiceBubbleProps = {
  playing: boolean;
  loading?: boolean;
  levels: number[];
  progress: number;
  durationLabel: string | null;
  onToggle: () => void;
  playLabel?: string;
  pauseLabel?: string;
};

const VoiceBubble = ({
  playing,
  loading = false,
  levels,
  progress,
  durationLabel,
  onToggle,
  playLabel = "Play voice message",
  pauseLabel = "Pause voice message",
}: VoiceBubbleProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const ToggleIcon = playing ? PauseIcon : PlayIcon;

  return (
    <View style={styles.bubble}>
      <PressableScale
        depth="control"
        accessibilityRole="button"
        accessibilityLabel={playing ? pauseLabel : playLabel}
        accessibilityState={{ busy: loading }}
        onPress={onToggle}
        style={styles.toggle}
      >
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.textOnAccent} />
        ) : (
          <ToggleIcon size={IconSize.md} color={theme.colors.textOnAccent} weight="regular" />
        )}
      </PressableScale>
      <Waveform levels={levels} progress={progress} activeColor="voiceActive" inactiveColor="textTertiary" />
      {durationLabel ? (
        <ThemedText variant="label" color="textSecondary" style={styles.duration}>
          {durationLabel}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default memo(VoiceBubble);
