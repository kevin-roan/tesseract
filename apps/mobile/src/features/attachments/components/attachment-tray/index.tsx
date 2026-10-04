import { useMemo } from "react";
import { ScrollView } from "react-native";
import Animated from "react-native-reanimated";

import { useAppTheme } from "@/hooks/use-app-theme";

import { useChipTransitions } from "../../hooks/use-chip-transitions";
import type { DraftAttachment } from "../../types";
import { formatBytes } from "../../utils/files";
import AttachmentChip from "../attachment-chip";
import createStyles from "./styles";

export type AttachmentTrayProps = {
  items: DraftAttachment[];
  onRemove: (key: string) => void;
  onRetry: (key: string) => void;
  onPaste?: () => void;
  pasteLabel?: string;
  pasteMeta?: string;
};

const AttachmentTray = ({
  items,
  onRemove,
  onRetry,
  onPaste,
  pasteLabel = "Paste image",
  pasteMeta = "From clipboard",
}: AttachmentTrayProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const motion = useChipTransitions();

  if (items.length === 0 && !onPaste) return null;

  return (
    <Animated.View exiting={motion.exiting}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.tray}
      >
        {onPaste ? (
          <Animated.View entering={motion.entering} exiting={motion.exiting} layout={motion.layout}>
            <AttachmentChip name={pasteLabel} kind="image" meta={pasteMeta} onPress={onPaste} />
          </Animated.View>
        ) : null}
        {items.map((item) => (
          <Animated.View key={item.key} entering={motion.entering} exiting={motion.exiting} layout={motion.layout}>
            <AttachmentChip
              name={item.name}
              kind={item.kind}
              thumbnailUri={item.uri}
              meta={item.sizeBytes !== null ? formatBytes(item.sizeBytes) : undefined}
              status={item.status}
              error={item.error}
              onRemove={() => onRemove(item.key)}
              onRetry={() => onRetry(item.key)}
            />
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
};

export default AttachmentTray;
