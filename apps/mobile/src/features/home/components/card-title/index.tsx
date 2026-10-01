import { useMemo } from "react";
import { View } from "react-native";
import type { Icon } from "phosphor-react-native";

import { Glass } from "@/components/glass";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import createStyles from "./styles";

export type CardTitleProps = {
  icon: Icon;
  title: string;
  trailing?: React.ReactNode;
};

/** Round glass icon badge, a heading, and an optional control pinned to the right. */
const CardTitle = ({ icon: IconComponent, title, trailing }: CardTitleProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <Glass style={styles.badge}>
        <IconComponent size={IconSize.md} color={theme.colors.text} weight="duotone" />
      </Glass>
      <ThemedText variant="h4" numberOfLines={1} style={styles.title} accessibilityRole="header">
        {title}
      </ThemedText>
      {trailing}
    </View>
  );
};

export default CardTitle;
