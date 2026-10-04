import { View } from "react-native";

import BottomSheet from "@/components/bottom-sheet";

import MenuRow from "./menu-row";
import type { MenuOption } from "./types";

export type { MenuOption } from "./types";

export type MenuSheetProps = {
  visible: boolean;
  title: string;
  options: MenuOption[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onDismissed?: () => void;
  testID?: string;
};

const MenuSheet = ({ visible, title, options, selectedId, onSelect, onClose, onDismissed, testID }: MenuSheetProps) => (
  <BottomSheet visible={visible} title={title} onClose={onClose} onDismissed={onDismissed} testID={testID}>
    <View accessibilityRole="menu">
      {options.map((option, index) => (
        <MenuRow
          key={option.id}
          option={option}
          index={index}
          selected={option.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </View>
  </BottomSheet>
);

export default MenuSheet;
