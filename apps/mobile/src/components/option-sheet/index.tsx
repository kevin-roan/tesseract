import { useMemo } from "react";
import { View } from "react-native";

import BottomSheet from "@/components/bottom-sheet";
import type { MenuOption } from "@/components/menu-sheet/types";
import { ThemedText } from "@/components/themed-text";
import { useAppTheme } from "@/hooks/use-app-theme";

import OptionRow from "./option-row";
import createStyles from "./styles";

export type OptionSheetProps = {
  visible: boolean;
  title: string;
  options: MenuOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onDismissed?: () => void;
  footnote?: string;
  closeLabel?: string;
  testID?: string;
};

const OptionSheet = ({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  onDismissed,
  footnote,
  closeLabel = "Close",
  testID,
}: OptionSheetProps) => {
  const theme = useAppTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <BottomSheet visible={visible} title={title} onClose={onClose} onDismissed={onDismissed} closeLabel={closeLabel} testID={testID}>
      <View accessibilityRole="menu" style={styles.group}>
        {options.map((option, index) => (
          <OptionRow
            key={option.id}
            option={option}
            index={index}
            selected={option.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </View>
      {footnote ? (
        <ThemedText variant="caption" color="textSecondary" style={styles.footnote}>
          {footnote}
        </ThemedText>
      ) : null}
    </BottomSheet>
  );
};

export default OptionSheet;
