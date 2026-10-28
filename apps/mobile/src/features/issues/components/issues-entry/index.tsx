import { KanbanIcon } from "phosphor-react-native";

import { ListGroup, ListRow } from "@/components/list-group";

import { useIssuesEntry } from "../../hooks/use-issues-entry";
import { ISSUES_COPY } from "../../utils/content";

export type IssuesEntryProps = {
  projectId: string;
};

const IssuesEntry = ({ projectId }: IssuesEntryProps) => {
  const entry = useIssuesEntry(projectId);
  return (
    <ListGroup>
      <ListRow
        label={ISSUES_COPY.entry}
        detail={ISSUES_COPY.entryDetail(entry.openCount)}
        icon={KanbanIcon}
        badge={entry.openCount > 0 ? entry.openCount : null}
        chevron
        onPress={entry.open}
        testID="project-issues"
      />
    </ListGroup>
  );
};

export default IssuesEntry;
