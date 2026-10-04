import { UserCircleIcon } from "phosphor-react-native";

import { ListGroup, ListRow } from "@/components/list-group";

import type { ClaudeAccountRowView } from "../../utils/accounts";

export type ClaudeAccountListProps = {
  rows: ClaudeAccountRowView[];
  onSelect: (id: string) => void;
  footnote?: string;
};

const ClaudeAccountList = ({ rows, onSelect, footnote }: ClaudeAccountListProps) => (
  <ListGroup footnote={footnote} testID="claude-accounts">
    {rows.map((row) => (
      <ListRow
        key={row.id}
        icon={UserCircleIcon}
        label={row.label}
        detail={row.detail}
        value={row.value}
        selected={row.selected}
        disabled={row.disabled}
        onPress={() => onSelect(row.id)}
        testID={`claude-account-${row.id}`}
      />
    ))}
  </ListGroup>
);

export default ClaudeAccountList;
