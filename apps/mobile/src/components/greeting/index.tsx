import { useMemo } from "react";

import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";
import { MaxFontSizeMultiplier } from "@/theme";

import useGetGreeting from "./hooks/useGetGreeting";
import createStyles from "./styles";
import { DEFAULT_GREETING_NAME } from "./utils/constants";

export type GreetingProps = {
  name?: string | null;
  date?: Date;
};

const Greeting = ({ name, date }: GreetingProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { salutation } = useGetGreeting(name || DEFAULT_GREETING_NAME, date);

  return (
    <ThemedText
      variant="greeting"
      numberOfLines={2}
      maxFontSizeMultiplier={MaxFontSizeMultiplier.heading}
      accessibilityRole="header"
      style={styles.title}
    >
      {salutation}
    </ThemedText>
  );
};

export { Greeting };

export default Greeting;
