import { ListGroup, ListRow } from "@/components/list-group";

import type { DeviceRow } from "../../utils/view";

export type AccountDevicesProps = {
  rows: readonly DeviceRow[];
  removing: string | null;
  removeLabel: string;
  onRemove: (row: DeviceRow) => void;
  testID?: string;
};

const AccountDevices = ({ rows, removing, removeLabel, onRemove, testID }: AccountDevicesProps) => (
  <ListGroup testID={testID}>
    {rows.map((row) => (
      <ListRow
        key={row.id}
        icon={row.icon}
        label={row.label}
        detail={row.detail}
        value={removeLabel}
        disabled={removing === row.id}
        onPress={() => onRemove(row)}
        accessibilityLabel={`${removeLabel} ${row.label}, ${row.detail}`}
        testID={testID ? `${testID}-${row.id}` : undefined}
      />
    ))}
  </ListGroup>
);

export default AccountDevices;
