import { useMemo } from "react";
import { View } from "react-native";
import type { Icon } from "phosphor-react-native";

import Chip from "@/components/chip";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ChipRowItem = {
  id: string;
  label: string;
  icon?: Icon;
  onPress?: () => void;
  disabled?: boolean;
};

export type ChipRowProps = {
  items: ChipRowItem[];
  label?: string;
  testID?: string;
};

/** Wrapping row of action chips, like the property chips under a title. */
const ChipRow = ({ items, label, testID }: ChipRowProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row} accessibilityLabel={label} testID={testID}>
      {items.map(({ id, ...item }) => (
        <Chip key={id} {...item} />
      ))}
    </View>
  );
};

export default ChipRow;
