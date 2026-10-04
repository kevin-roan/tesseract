import type { Icon } from "phosphor-react-native";

import { ListGroup, ListRow } from "@/components/list-group";

export type ChoiceRow = {
  id: string;
  label: string;
  detail?: string;
  value?: string;
  icon?: Icon;
  selected: boolean;
  disabled?: boolean;
};

export type ChoiceListProps = {
  rows: ChoiceRow[];
  onSelect: (id: string) => void;
  title?: string;
  footnote?: string;
  testID?: string;
};

const ChoiceList = ({ rows, onSelect, title, footnote, testID }: ChoiceListProps) => (
  <ListGroup title={title} footnote={footnote} testID={testID}>
    {rows.map((row) => (
      <ListRow
        key={row.id}
        icon={row.icon}
        label={row.label}
        detail={row.detail}
        value={row.value}
        selected={row.selected}
        disabled={row.disabled}
        onPress={() => onSelect(row.id)}
        testID={testID ? `${testID}-${row.id}` : undefined}
      />
    ))}
  </ListGroup>
);

export default ChoiceList;
