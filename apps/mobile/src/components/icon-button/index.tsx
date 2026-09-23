import { useMemo } from "react";
import type { Icon } from "phosphor-react-native";

import { GlassButton } from "@/components/glass";
import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors, type Tone } from "@/lib/tone";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type IconButtonProps = {
  icon: Icon;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  tone?: Tone;
};

const IconButton = ({ icon: IconComponent, label, onPress, disabled, tone }: IconButtonProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const color = tone ? theme.colors[ToneColors[tone].foreground] : theme.colors.text;

  return (
    <GlassButton accessibilityLabel={label} onPress={onPress} disabled={disabled} style={styles.button}>
      <IconComponent size={IconSize.md} color={color} weight="bold" />
    </GlassButton>
  );
};

export default IconButton;
