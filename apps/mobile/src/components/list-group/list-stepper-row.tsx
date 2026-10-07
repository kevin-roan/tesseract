import { useMemo } from "react";
import { View } from "react-native";
import { MinusIcon, PlusIcon } from "phosphor-react-native";

import IconButton from "@/components/icon-button";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";
import { stepValue } from "./utils/step";

export type ListStepperRowProps = {
  label: string;
  detail?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string;
  onChange: (value: number) => void;
  decreaseLabel?: string;
  increaseLabel?: string;
  disabled?: boolean;
  testID?: string;
};

const ListStepperRow = ({
  label,
  detail,
  value,
  min,
  max,
  step = 1,
  format = String,
  onChange,
  decreaseLabel = "Decrease",
  increaseLabel = "Increase",
  disabled = false,
  testID,
}: ListStepperRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const shown = format(value);

  return (
    <View style={[styles.row, disabled && styles.rowDisabled]} accessibilityLabel={[label, shown].join(", ")} testID={testID}>
      <View style={styles.body}>
        <ThemedText variant="body" numberOfLines={1}>
          {label}
        </ThemedText>
        {detail ? (
          <ThemedText variant="bodySmall" color="textSecondary" numberOfLines={2}>
            {detail}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.stepper}>
        <IconButton
          icon={MinusIcon}
          label={`${decreaseLabel} ${label}`}
          size="md"
          disabled={disabled || value <= min}
          onPress={() => onChange(stepValue(value, -step, min, max))}
        />
        <ThemedText variant="body" style={styles.stepperValue} numberOfLines={1}>
          {shown}
        </ThemedText>
        <IconButton
          icon={PlusIcon}
          label={`${increaseLabel} ${label}`}
          size="md"
          disabled={disabled || value >= max}
          onPress={() => onChange(stepValue(value, step, min, max))}
        />
      </View>
    </View>
  );
};

export default ListStepperRow;
