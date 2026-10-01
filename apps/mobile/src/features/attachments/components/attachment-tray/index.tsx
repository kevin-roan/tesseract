import { useMemo } from "react";
import { ScrollView } from "react-native";

import { useAppTheme } from "@/hooks/use-app-theme";

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

  if (items.length === 0 && !onPaste) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.tray}
    >
      {onPaste ? <AttachmentChip name={pasteLabel} kind="image" meta={pasteMeta} onPress={onPaste} /> : null}
      {items.map((item) => (
        <AttachmentChip
          key={item.key}
          name={item.name}
          kind={item.kind}
          thumbnailUri={item.uri}
          meta={item.sizeBytes !== null ? formatBytes(item.sizeBytes) : undefined}
          status={item.status}
          error={item.error}
          onRemove={() => onRemove(item.key)}
          onRetry={() => onRetry(item.key)}
        />
      ))}
    </ScrollView>
  );
};

export default AttachmentTray;
