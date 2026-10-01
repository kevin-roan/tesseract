import { useMemo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { ArrowUpIcon, MicrophoneIcon, PlusIcon, WaveformIcon } from "phosphor-react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { HitSlop, IconSize } from "@/theme";

import createStyles from "./styles";

export type ComposerPrimary = "send" | "mic";

export type ComposerBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder: string;
  primary: ComposerPrimary;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  busy?: boolean;
  onAttach?: () => void;
  attachDisabled?: boolean;
  onMic?: () => void;
  micDisabled?: boolean;
  chips?: ReactNode;
  toolbar?: ReactNode;
  banner?: ReactNode;
  accessory?: ReactNode;
  replacement?: ReactNode;
  maxLength?: number;
  maxLines?: number;
  sendLabel?: string;
  micLabel?: string;
  attachLabel?: string;
  testID?: string;
};

const ComposerBar = ({
  value,
  onChangeText,
  onFocus,
  onBlur,
  placeholder,
  primary,
  onPrimary,
  primaryDisabled = false,
  busy = false,
  onAttach,
  attachDisabled = false,
  onMic,
  micDisabled = false,
  chips,
  toolbar,
  banner,
  accessory,
  replacement,
  maxLength,
  maxLines = 6,
  sendLabel = "Send",
  micLabel = "Record voice message",
  attachLabel = "Attach",
  testID,
}: ComposerBarProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, maxLines), [theme, maxLines]);
  const handlePrimary = useHapticPress(onPrimary, true, primary === "send" ? "send" : "recordStart");
  const handleMic = useHapticPress(onMic, true, "recordStart");
  const PrimaryIcon = primary === "send" ? ArrowUpIcon : WaveformIcon;
  const disabled = primaryDisabled || busy;
  const showMic = onMic && primary === "send";

  return (
    <View style={styles.card} testID={testID}>
      {banner}
      {accessory}
      {replacement ?? (
        <>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            accessibilityLabel={placeholder}
            placeholderTextColor={theme.colors.textTertiary}
            selectionColor={theme.colors.focusRing}
            multiline
            maxLength={maxLength}
            autoCapitalize="sentences"
            autoCorrect
            style={styles.input}
          />
          <View style={styles.actions}>
            {onAttach ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={attachLabel}
                accessibilityState={{ disabled: attachDisabled }}
                hitSlop={HitSlop.sm}
                disabled={attachDisabled}
                onPress={onAttach}
                style={({ pressed }) => [styles.round, styles.outlined, pressed && styles.pressed, attachDisabled && styles.disabled]}
              >
                <PlusIcon size={IconSize.md} color={theme.colors.text} />
              </Pressable>
            ) : null}
            <View style={styles.tools}>
              {chips}
              {toolbar}
            </View>
            {showMic ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={micLabel}
                accessibilityState={{ disabled: micDisabled }}
                hitSlop={HitSlop.sm}
                disabled={micDisabled}
                onPress={handleMic}
                style={({ pressed }) => [styles.round, pressed && styles.pressed, micDisabled && styles.disabled]}
              >
                <MicrophoneIcon size={IconSize.md} color={theme.colors.text} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primary === "send" ? sendLabel : micLabel}
              accessibilityState={{ disabled, busy }}
              disabled={disabled}
              onPress={handlePrimary}
              style={({ pressed }) => [styles.round, styles.primary, pressed && styles.pressed, disabled && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator size="small" color={theme.colors.accentInk} />
              ) : (
                <PrimaryIcon size={IconSize.md} color={theme.colors.accentInk} weight="bold" />
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
};

export default ComposerBar;
