import { memo, useMemo } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { Image } from "expo-image";
import { ArrowClockwiseIcon, XIcon } from "phosphor-react-native";
import type { UploadKind } from "@theone/protocol";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { HitSlop, IconSize } from "@/theme";

import type { AttachmentStatus } from "../../types";
import { KIND_ICONS } from "../../utils/sources";
import createStyles from "./styles";

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
  const KindIcon = KIND_ICONS[kind];
  const failed = status === "error";
  const showsImage = kind === "image" && Boolean(thumbnailUri);

  const statusMark =
    status === "uploading" ? (
      <ActivityIndicator size="small" color={showsImage ? theme.colors.textInverse : theme.colors.accentStrong} />
    ) : failed && onRetry ? (
      <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${name}`} hitSlop={HitSlop.sm} onPress={onRetry}>
        <ArrowClockwiseIcon size={IconSize.md} color={showsImage ? theme.colors.textInverse : theme.colors.danger} weight="bold" />
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
      <XIcon size={IconSize.xs} color={showsImage ? theme.colors.textInverse : theme.colors.textSecondary} weight="bold" />
    </Pressable>
  ) : null;

  if (showsImage) {
    return (
      <Pressable
        accessibilityRole={onPress ? "imagebutton" : "image"}
        accessibilityLabel={failed && error ? `${name}. ${error}` : name}
        disabled={!onPress}
        onPress={onPress}
        style={[styles.thumb, failed && styles.failed]}
      >
        <Image source={{ uri: thumbnailUri ?? undefined, headers: thumbnailHeaders }} style={styles.image} contentFit="cover" transition={150} />
        {statusMark ? <View style={styles.thumbOverlay}>{statusMark}</View> : null}
        {removeButton}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      accessibilityLabel={failed && error ? `${name}. ${error}` : name}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.pill, failed && styles.failed]}
    >
      <View style={styles.kind}>
        <KindIcon size={IconSize.md} color={theme.colors.accentStrong} weight="bold" />
      </View>
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
    </Pressable>
  );
};

export default memo(AttachmentChip);
