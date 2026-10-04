import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";
import { ArrowRightIcon, BackspaceIcon } from "phosphor-react-native";

import PressableScale from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useHapticPress } from "@/hooks/use-haptic-press";
import { IconSize } from "@/theme";

import createStyles from "./styles";
import { PIN_KEYS, pinDotCount, pinKeyId, pinKeyLabel, type PinKey } from "./utils/keys";

export type { PinKey } from "./utils/keys";

export type PinPadProps = {
  entered: number;
  minLength: number;
  onPress: (key: PinKey) => void;
  canSubmit: boolean;
  submitLabel: string;
  loading?: boolean;
  disabled?: boolean;
  error?: boolean;
};

type PinPadKeyProps = {
  pinKey: PinKey;
  label: string;
  onPress: (key: PinKey) => void;
  disabled: boolean;
  loading: boolean;
  styles: ReturnType<typeof createStyles>;
};

const PinPadKey = ({ pinKey, label, onPress, disabled, loading, styles }: PinPadKeyProps) => {
  const theme = useAppTheme();
  const handlePress = useHapticPress(() => onPress(pinKey), !disabled, pinKey.kind === "submit" ? "selection" : "tap");
  const submit = pinKey.kind === "submit";

  return (
    <PressableScale
      onPress={disabled ? undefined : handlePress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: submit && loading }}
      style={[styles.key, pinKey.kind === "delete" && styles.keyQuiet, submit && styles.keySubmit, disabled && styles.disabled]}
      pressedStyle={submit ? undefined : styles.keyPressed}
    >
      {pinKey.kind === "digit" ? (
        <ThemedText variant="title">{pinKey.digit}</ThemedText>
      ) : pinKey.kind === "delete" ? (
        <BackspaceIcon size={IconSize.lg} color={theme.colors.textSecondary} />
      ) : loading ? (
        <ActivityIndicator color={theme.colors.accentInk} />
      ) : (
        <ArrowRightIcon size={IconSize.lg} color={theme.colors.accentInk} />
      )}
    </PressableScale>
  );
};

const PinPad = ({ entered, minLength, onPress, canSubmit, submitLabel, loading = false, disabled = false, error = false }: PinPadProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dots = pinDotCount(entered, minLength);

  return (
    <View style={styles.pad}>
      <View style={styles.dots} accessibilityRole="text" accessibilityLabel={`${entered} digits entered`}>
        {Array.from({ length: dots }, (_, index) => (
          <View key={index} style={[styles.dot, index < entered && styles.dotFilled, error && styles.dotError]} />
        ))}
      </View>
      <View style={styles.grid}>
        {PIN_KEYS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((key) => (
              <PinPadKey
                key={pinKeyId(key)}
                pinKey={key}
                label={pinKeyLabel(key, submitLabel)}
                onPress={onPress}
                disabled={disabled || loading || (key.kind === "submit" && !canSubmit)}
                loading={loading}
                styles={styles}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

export default PinPad;
