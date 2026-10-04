import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { ArrowClockwiseIcon, ArrowUpIcon, TrashIcon } from "phosphor-react-native";

import { ThemedText } from "@/components/themed-text";
import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize } from "@/theme";

import type { VoicePhase } from "../../types";
import LiveWaveform from "../live-waveform";
import createStyles from "./styles";

export type RecordingBarProps = {
  phase: Exclude<VoicePhase, "idle">;
  levels: number[];
  elapsedLabel: string;
  statusLabel?: string;
  error?: string | null;
  onCancel: () => void;
  onSend: () => void;
  onRetry: () => void;
};

const RecordingBar = ({
  phase,
  levels,
  elapsedLabel,
  statusLabel,
  error,
  onCancel,
  onSend,
  onRetry,
}: RecordingBarProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const recording = phase === "recording";
  const failed = phase === "failed";

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <PressableScale
          depth="control"
          accessibilityRole="button"
          accessibilityLabel={recording ? "Cancel recording" : "Discard recording"}
          hitSlop={HitSlop.sm}
          onPress={onCancel}
          disabled={phase === "transcribing"}
          style={[styles.cancel, phase === "transcribing" && styles.disabled]}
        >
          <TrashIcon size={IconSize.md} color={theme.colors.danger} weight="light" />
        </PressableScale>
        {recording ? <View style={styles.dot} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" /> : null}
        <LiveWaveform levels={levels} live={recording} />
        <ThemedText variant="label" color="textSecondary" style={styles.elapsed}>
          {elapsedLabel}
        </ThemedText>
        {phase === "transcribing" ? (
          <View style={styles.action} accessibilityLabel={statusLabel} accessibilityRole="progressbar">
            <ActivityIndicator size="small" color={theme.colors.textOnAccent} />
          </View>
        ) : (
          <PressableScale
            depth="control"
            accessibilityRole="button"
            accessibilityLabel={failed ? "Retry voice message" : "Send voice message"}
            hitSlop={HitSlop.sm}
            onPress={failed ? onRetry : onSend}
            style={styles.action}
          >
            {failed ? (
              <ArrowClockwiseIcon size={IconSize.md} color={theme.colors.textOnAccent} weight="regular" />
            ) : (
              <ArrowUpIcon size={IconSize.md} color={theme.colors.textOnAccent} weight="regular" />
            )}
          </PressableScale>
        )}
      </View>
      {phase === "transcribing" && statusLabel ? (
        <ThemedText variant="caption" color="textSecondary" style={styles.status}>
          {statusLabel}
        </ThemedText>
      ) : null}
      {failed && error ? (
        <ThemedText variant="caption" color="danger" style={styles.status} accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default RecordingBar;
