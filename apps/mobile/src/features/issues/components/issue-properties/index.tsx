import { TagIcon } from "phosphor-react-native";

import { ListGroup, ListPickerRow, ListRow } from "@/components/list-group";

import type { IssueDetailState } from "../../hooks/use-issue-detail-screen";
import { ISSUE_ASSIGNEE_ICONS, ISSUE_DETAIL_COPY, ISSUE_PRIORITY_ICONS, ISSUE_STATUS_ICONS } from "../../utils/content";
import { formatLabels } from "../../utils/issues";
import { ASSIGNEE_OPTIONS, PRIORITY_OPTIONS, STATUS_OPTIONS } from "../../utils/options";

export type IssuePropertiesProps = {
  properties: IssueDetailState["properties"];
};

const IssueProperties = ({ properties }: IssuePropertiesProps) => (
  <ListGroup title={ISSUE_DETAIL_COPY.properties} testID="issue-properties">
    <ListPickerRow
      label={ISSUE_DETAIL_COPY.status}
      icon={properties.status ? ISSUE_STATUS_ICONS[properties.status] : undefined}
      options={STATUS_OPTIONS}
      selectedId={properties.status}
      onSelect={properties.selectStatus}
      testID="issue-status"
    />
    <ListPickerRow
      label={ISSUE_DETAIL_COPY.priority}
      icon={properties.priority ? ISSUE_PRIORITY_ICONS[properties.priority] : undefined}
      options={PRIORITY_OPTIONS}
      selectedId={properties.priority}
      onSelect={properties.selectPriority}
      testID="issue-priority"
    />
    <ListPickerRow
      label={ISSUE_DETAIL_COPY.assignee}
      icon={properties.assignee && properties.assignee !== "claude" ? ISSUE_ASSIGNEE_ICONS[properties.assignee] : undefined}
      options={ASSIGNEE_OPTIONS}
      selectedId={properties.assignee}
      onSelect={properties.selectAssignee}
      testID="issue-assignee"
    />
    <ListRow
      label={ISSUE_DETAIL_COPY.labels}
      icon={TagIcon}
      value={properties.labels.length > 0 ? formatLabels(properties.labels) : ISSUE_DETAIL_COPY.noLabels}
      chevron
      onPress={properties.editLabels}
      testID="issue-labels"
    />
  </ListGroup>
);

export default IssueProperties;
