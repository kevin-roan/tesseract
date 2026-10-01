import { useMemo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";

import { ThemedText } from "@/components/themed-text";
import { uploadKindOf } from "@/features/attachments/utils/files";
import { useAppTheme } from "@/hooks/use-app-theme";

import type { AttachDraft } from "../../types";
import createStyles from "./styles";

export type DraftPreviewProps = {
  draft: AttachDraft;
};

const DraftPreview = ({ draft }: DraftPreviewProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const images = draft.files.filter((file) => uploadKindOf(file.mimeType) === "image");
  const others = draft.files.length - images.length;

  return (
    <View style={styles.preview} testID="draft-preview">
      {images.length > 0 ? (
        <View style={styles.thumbs}>
          {images.map((file) => (
            <Image key={file.uri} source={{ uri: file.uri }} contentFit="cover" style={styles.thumb} accessibilityLabel={file.name} />
          ))}
        </View>
      ) : null}
      {draft.text ? (
        <ThemedText variant="bodySmall" numberOfLines={4}>
          {draft.text}
        </ThemedText>
      ) : null}
      {others > 0 ? (
        <ThemedText variant="caption" color="textSecondary">
          {others === 1 ? "1 file" : `${others} files`}
        </ThemedText>
      ) : null}
    </View>
  );
};

export default DraftPreview;
