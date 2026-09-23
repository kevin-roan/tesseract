import { useMemo } from "react";
import { View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import useGetGreeting from "./hooks/useGetGreeting";
import createStyles from "./styles";

const GreetinText = () => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const date = new Date();
  const username = "Kevin Roan";
  const { salutation, timeOfDay } = useGetGreeting(username, date);

  return (
    <View style={styles.container}>
      <ThemedText variant="caption" color="textSecondary">
        {salutation}
      </ThemedText>
      <ThemedText variant="h3">{timeOfDay}</ThemedText>
    </View>
  );
};

export default GreetinText;
