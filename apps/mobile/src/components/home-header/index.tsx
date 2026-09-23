import { useMemo } from "react";
import { View } from "react-native";
import { Feather } from "expo-vector-icons";

import { GlassButton } from "@/components/glass";
import GreetinText from "@/components/greeting";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";
import createStyles from "./styles";

type HomeHeaderProps = {
  onOpenProfile?: () => void;
};

const HomeHeader = ({ onOpenProfile }: HomeHeaderProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <GreetinText />
      <GlassButton
        accessibilityLabel="Open profile"
        onPress={() => onOpenProfile?.()}
        effect="regular"
        style={styles.action}
        interactive={false}
      >
        <Feather name="inbox" size={IconSize.md} color={theme.colors.text} />
      </GlassButton>
    </View>
  );
};

export default HomeHeader;
