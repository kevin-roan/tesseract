import { useCallback, useState } from "react";
import type { Icon } from "phosphor-react-native";

import type { MenuOption } from "@/components/menu-sheet/types";
import OptionSheet from "@/components/option-sheet";

import ListRow from "./list-row";

export type ListPickerRowProps = {
  label: string;
  icon?: Icon;
  options: MenuOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  footnote?: string;
  testID?: string;
};

const ListPickerRow = ({ label, icon, options, selectedId, onSelect, footnote, testID }: ListPickerRowProps) => {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => setOpen(true), []);
  const hide = useCallback(() => setOpen(false), []);
  const select = useCallback(
    (id: string) => {
      onSelect(id);
      setOpen(false);
    },
    [onSelect],
  );
  const value = options.find((option) => option.id === selectedId)?.label;

  return (
    <>
      <ListRow label={label} icon={icon} value={value} chevron onPress={show} testID={testID} />
      <OptionSheet
        visible={open}
        title={label}
        options={options}
        selectedId={selectedId}
        onSelect={select}
        onClose={hide}
        footnote={footnote}
        testID={testID ? `${testID}-sheet` : undefined}
      />
    </>
  );
};

export default ListPickerRow;
