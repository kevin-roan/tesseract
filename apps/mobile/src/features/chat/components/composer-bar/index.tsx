import { useMemo, type ReactNode } from "react";
import { ActivityIndicator, TextInput, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { ArrowUpIcon, MicrophoneIcon, PlusIcon, WaveformIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { HitSlop, IconSize } from "@/theme";

import { useComposerFocus } from "./hooks/use-composer-focus";
import { useEnableMotion } from "./hooks/use-enable-motion";
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
  const focus = useComposerFocus(onFocus, onBlur);
  const primaryMotion = useEnableMotion(!disabled);

  return (
    <Animated.View style={[styles.card, focus.style]} testID={testID}>
      {banner}
      {accessory}
      {replacement ?? (
        <>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onFocus={focus.onFocus}
            onBlur={focus.onBlur}
            placeholder={placeholder}
            accessibilityLabel={placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            selectionColor={theme.colors.focusRing}
            multiline
            maxLength={maxLength}
            autoCapitalize="sentences"
            autoCorrect
            style={styles.input}
          />
          <View style={styles.actions}>
            {onAttach ? (
              <PressableScale
                depth="control"
                accessibilityRole="button"
                accessibilityLabel={attachLabel}
                accessibilityState={{ disabled: attachDisabled }}
                hitSlop={HitSlop.sm}
                disabled={attachDisabled}
                onPress={onAttach}
                style={[styles.button, styles.outlined, attachDisabled && styles.disabled]}
              >
                <PlusIcon size={IconSize.md} color={theme.colors.text} weight="light" />
              </PressableScale>
            ) : null}
            <View style={styles.tools}>
              {chips}
              {toolbar}
            </View>
            {showMic ? (
              <PressableScale
                depth="control"
                accessibilityRole="button"
                accessibilityLabel={micLabel}
                accessibilityState={{ disabled: micDisabled }}
                hitSlop={HitSlop.sm}
                disabled={micDisabled}
                onPress={handleMic}
                style={[styles.button, micDisabled && styles.disabled]}
              >
                <MicrophoneIcon size={IconSize.md} color={theme.colors.textSecondary} weight="light" />
              </PressableScale>
            ) : null}
            <Animated.View style={primaryMotion.style}>
              <PressableScale
                depth="control"
                accessibilityRole="button"
                accessibilityLabel={primary === "send" ? sendLabel : micLabel}
                accessibilityState={{ disabled, busy }}
                hitSlop={HitSlop.sm}
                disabled={disabled}
                onPress={handlePrimary}
                style={[styles.button, styles.primary]}
              >
                <LayoutAnimationConfig skipEntering>
                  <Animated.View key={busy ? "busy" : primary} entering={primaryMotion.iconEntering}>
                    {busy ? (
                      <ActivityIndicator size="small" color={theme.colors.accentInk} />
                    ) : (
                      <PrimaryIcon size={IconSize.md} color={theme.colors.accentInk} weight="regular" />
                    )}
                  </Animated.View>
                </LayoutAnimationConfig>
              </PressableScale>
            </Animated.View>
          </View>
        </>
      )}
    </Animated.View>
  );
};

export default ComposerBar;
