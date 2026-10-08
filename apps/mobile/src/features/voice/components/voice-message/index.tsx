import { useMemo } from "react";
import { View } from "react-native";
import type { Upload } from "@tesseract/protocol";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import { useVoicePlayback } from "../../hooks/use-voice-playback";
import VoiceBubble from "../voice-bubble";
import createStyles from "./styles";

export type VoiceMessageProps = {
  upload: Upload;
  transcript?: string;
};

const VoiceMessage = ({ upload, transcript }: VoiceMessageProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const playback = useVoicePlayback(upload);

  return (
    <View style={styles.message}>
      <VoiceBubble
        playing={playback.playing}
        loading={playback.loading}
        levels={playback.levels}
        progress={playback.progress}
        durationLabel={playback.durationLabel}
        onToggle={playback.toggle}
      />
      {playback.error ? (
        <ThemedText variant="caption" color="danger" style={styles.caption}>
          {playback.error}
        </ThemedText>
      ) : null}
      {transcript ? (
        <ThemedText variant="bodySmall" color="textSecondary" style={styles.caption} selectable>
          {transcript}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default VoiceMessage;
