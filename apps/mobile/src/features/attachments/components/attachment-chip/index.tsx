import { memo, useMemo } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { ArrowClockwiseIcon, XIcon } from "phosphor-react-native";
import type { UploadKind } from "@theone/protocol";

import IconTile from "@/components/icon-tile";
import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ControlHeight, HitSlop, IconSize } from "@/theme";

import type { AttachmentStatus } from "../../types";
import { KIND_ICONS } from "../../utils/sources";
import createStyles, { onMediaColor } from "./styles";

export type AttachmentChipProps = {
  name: string;
  kind: UploadKind;
  thumbnailUri?: string | null;
  thumbnailHeaders?: Record<string, string>;
  meta?: string;
  status?: AttachmentStatus;
  error?: string | null;
  large?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  onRetry?: () => void;
};

const AttachmentChip = ({
  name,
  kind,
  thumbnailUri,
  thumbnailHeaders,
  meta,
  status = "ready",
  error,
  large = false,
  onPress,
  onRemove,
  onRetry,
}: AttachmentChipProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, large), [theme, large]);
  const onMedia = onMediaColor(theme);
  const KindIcon = KIND_ICONS[kind];
  const failed = status === "error";
  const showsImage = kind === "image" && Boolean(thumbnailUri);

  const statusMark =
    status === "uploading" ? (
      <ActivityIndicator size="small" color={showsImage ? onMedia : theme.colors.text} />
    ) : failed && onRetry ? (
      <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${name}`} hitSlop={HitSlop.sm} onPress={onRetry}>
        <ArrowClockwiseIcon size={IconSize.md} color={showsImage ? onMedia : theme.colors.danger} weight="regular" />
      </Pressable>
    ) : null;

  const removeButton = onRemove ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Remove ${name}`}
      hitSlop={HitSlop.sm}
      onPress={onRemove}
      style={showsImage ? styles.removeFloating : styles.removeInline}
    >
      <XIcon size={IconSize.xs} color={showsImage ? onMedia : theme.colors.textSecondary} weight="regular" />
    </Pressable>
  ) : null;

  if (showsImage) {
    return (
      <PressableScale
        depth="control"
        accessibilityRole={onPress ? "imagebutton" : "image"}
        accessibilityLabel={failed && error ? `${name}. ${error}` : name}
        disabled={!onPress}
        onPress={onPress}
        style={[styles.thumb, failed && styles.failed]}
      >
        <Image source={{ uri: thumbnailUri ?? undefined, headers: thumbnailHeaders }} style={styles.image} contentFit="cover" transition={150} />
        {statusMark ? <View style={styles.thumbOverlay}>{statusMark}</View> : null}
        {removeButton}
      </PressableScale>
    );
  }

  return (
    <PressableScale
      depth="control"
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={failed && error ? `${name}. ${error}` : name}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.pill, failed && styles.failed]}
    >
      <IconTile icon={KindIcon} size={ControlHeight.md} iconSize={IconSize.md} radius="md" />
      <View style={styles.body}>
        <ThemedText variant="label" numberOfLines={1}>
          {name}
        </ThemedText>
        {failed && error ? (
          <ThemedText variant="caption" color="danger" numberOfLines={1}>
            {error}
          </ThemedText>
        ) : meta ? (
          <ThemedText variant="caption" color="textTertiary" numberOfLines={1}>
            {meta}
          </ThemedText>
        ) : null}
      </View>
      {statusMark}
      {removeButton}
    </PressableScale>
  );
};

export default memo(AttachmentChip);
