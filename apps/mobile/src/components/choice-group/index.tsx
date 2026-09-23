import { useMemo } from "react";
import { ScrollView, View } from "react-native";
import type { Icon } from "phosphor-react-native";

import Chip from "@/components/chip";
import { useAppTheme } from "@/hooks/use-app-theme";

import createStyles from "./styles";

export type ChoiceOption = {
  id: string;
  label: string;
  icon?: Icon;
};

export type ChoiceGroupProps = {
  options: ChoiceOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onLongPress?: (id: string) => void;
  scrollable?: boolean;
  label?: string;
};

const ChoiceGroup = ({ options, selectedId, onSelect, onLongPress, scrollable = false, label }: ChoiceGroupProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const chips = options.map(({ id, label: text, icon }) => (
    <Chip
      key={id}
      label={text}
      icon={icon}
      selected={id === selectedId}
      onPress={() => onSelect(id)}
      onLongPress={onLongPress ? () => onLongPress(id) : undefined}
    />
  ));

  if (scrollable) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        accessibilityLabel={label}
      >
        {chips}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.row, styles.wrap]} accessibilityLabel={label}>
      {chips}
    </View>
  );
};

export default ChoiceGroup;
