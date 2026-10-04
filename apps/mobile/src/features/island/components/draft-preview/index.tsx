import { useMemo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import Animated from "react-native-reanimated";

import { Surface } from "@/components/surface";
import { ThemedText } from "@/components/themed-text";
import { uploadKindOf } from "@/features/attachments/utils/files";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEntrance } from "@/hooks/use-entrance";

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
  const entering = useEntrance(0, "tight");

  return (
    <Animated.View entering={entering}>
      <Surface style={styles.preview} testID="draft-preview">
        {images.length > 0 ? (
          <View style={styles.thumbs}>
            {images.map((file) => (
              <Image key={file.uri} source={{ uri: file.uri }} contentFit="cover" style={styles.thumb} accessibilityLabel={file.name} />
            ))}
          </View>
        ) : null}
        {draft.text ? (
          <ThemedText variant="caption" numberOfLines={4}>
            {draft.text}
          </ThemedText>
        ) : null}
        {others > 0 ? (
          <ThemedText variant="caption" color="textTertiary" style={styles.count}>
            {others === 1 ? "1 file" : `${others} files`}
          </ThemedText>
        ) : null}
      </Surface>
    </Animated.View>
  );
};

export default DraftPreview;
