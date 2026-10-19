import { ListGroup } from "../../components/GroupBand";
import { KeyedList } from "../../components/KeyedList";
import { RecordRow } from "../../components/RecordRow";
import { PROCESSES_LABELS as L } from "../../features/processes/labels";
import type { ProcessGroupModel } from "../../features/processes/types";
import { processRow, type ProcessRowHandlers } from "./rows";

export interface ProcessGroupProps {
  group: ProcessGroupModel;
  pending: ReadonlySet<string>;
  handlers: ProcessRowHandlers;
}

export function ProcessGroup({ group, pending, handlers }: ProcessGroupProps) {
  return (
    <ListGroup icon={group.icon} title={group.title} count={group.rows.length}>
      <KeyedList
        divided
        label={L.listLabel(group.title)}
        items={group.rows}
        getKey={(row) => row.key}
        renderItem={(row) => <RecordRow {...processRow(row, group.icon, pending.has(row.key), handlers)} />}
      />
    </ListGroup>
  );
}
