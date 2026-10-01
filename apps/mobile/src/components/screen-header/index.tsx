import { useMemo, type ReactNode } from "react";
import { View } from "react-native";
import { ArrowLeftIcon, XIcon, type Icon } from "phosphor-react-native";

import IconButton from "@/components/icon-button";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import type { Tone } from "@/lib/tone";

import createStyles from "./styles";

export type HeaderAction = {
  id: string;
  icon: Icon;
  label: string;
  hint?: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: Tone;
};

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  dismissible?: boolean;
  actions?: HeaderAction[];
  accessory?: ReactNode;
  large?: boolean;
};

const ScreenHeader = ({
  title,
  subtitle,
  onBack,
  dismissible = false,
  actions,
  accessory,
  large = false,
}: ScreenHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.header}>
      {onBack ? (
        <IconButton
          icon={dismissible ? XIcon : ArrowLeftIcon}
          label={dismissible ? "Close" : "Go back"}
          onPress={onBack}
          size="md"
        />
      ) : null}
      <View style={styles.titles}>
        <View style={styles.titleRow}>
          <ThemedText variant={large ? "h1" : "h3"} numberOfLines={1} accessibilityRole="header" style={styles.title}>
            {title}
          </ThemedText>
          {accessory}
        </View>
        {subtitle ? (
          <ThemedText variant="caption" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {actions?.map(({ id, ...action }) => <IconButton key={id} {...action} />)}
    </View>
  );
};

export default ScreenHeader;
