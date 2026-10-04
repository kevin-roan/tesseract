import type { Icon } from "phosphor-react-native";

export type MenuOption = {
  id: string;
  label: string;
  description?: string;
  icon?: Icon;
  badge?: string;
  disabled?: boolean;
};
