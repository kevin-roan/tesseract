import { useMemo } from "react";
import { View } from "react-native";
import { SparkleIcon } from "phosphor-react-native";

import { useAppTheme } from "@/hooks/use-app-theme";
import { AvatarSize, IconSize } from "@/theme";

import createStyles from "./styles";

export type AssistantAvatarProps = {
  size?: number;
};

const AssistantAvatar = ({ size = AvatarSize.xs }: AssistantAvatarProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme, size), [theme, size]);

  return (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <SparkleIcon size={Math.min(IconSize.xs, size * 0.6)} color={theme.colors.text} weight="light" />
    </View>
  );
};

export default AssistantAvatar;
