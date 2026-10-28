import type { Issue, IssueStatus } from "@tesseract/protocol";
import { GroupBand } from "../../../../components/GroupBand";
import { KeyedList } from "../../../../components/KeyedList";
import { Row } from "../../../../components/Row";
import { Text } from "../../../../components/Text";
import { STATUS_APPEARANCE } from "./constants";
import { AgentIndicator, AssigneeAvatar, LabelPills, PriorityIcon, StatusIcon } from "./IssueGlyphs";
import { ISSUES_LABELS as L, STATUS_LABELS } from "./labels";
import { issueIdentifier } from "./model";
import type { IssueColumn } from "./types";
import styles from "./IssuesTab.module.css";

export interface IssueListProps {
  columns: readonly IssueColumn<Issue>[];
  onOpen(id: string): void;
  onCreate(status: IssueStatus): void;
}

export function IssueList({ columns, onOpen, onCreate }: IssueListProps) {
  return (
    <div className={styles.groups} role="group" aria-label={L.list}>
      {columns
        .filter((column) => column.issues.length > 0)
        .map(({ status, issues }) => (
          <section key={status} className={styles.group}>
            <GroupBand
              title={STATUS_LABELS[status]}
              icon={STATUS_APPEARANCE[status].icon}
              iconColor={STATUS_APPEARANCE[status].color}
              count={issues.length}
              actionLabel={L.newIssueIn(STATUS_LABELS[status])}
              onAction={() => onCreate(status)}
            />
            <KeyedList
              divided
              label={STATUS_LABELS[status]}
              items={issues}
              getKey={(issue) => issue.id}
              renderItem={(issue) => <IssueRow issue={issue} onOpen={onOpen} />}
            />
          </section>
        ))}
    </div>
  );
}

function IssueRow({ issue, onOpen }: { issue: Issue; onOpen(id: string): void }) {
  const identifier = issueIdentifier(issue);
  return (
    <Row onActivate={() => onOpen(issue.id)} label={`${identifier} ${issue.title}`} className={styles.row}>
      <PriorityIcon priority={issue.priority} />
      <Text variant="caption" color="text-tertiary" tabular className={styles.rowId}>
        {identifier}
      </Text>
      <StatusIcon status={issue.status} />
      <Text variant="body" className={styles.rowTitle}>
        {issue.title}
      </Text>
      <LabelPills labels={issue.labels} className={styles.rowLabels} />
      <AgentIndicator issue={issue} />
      <AssigneeAvatar assignee={issue.assignee} />
    </Row>
  );
}
