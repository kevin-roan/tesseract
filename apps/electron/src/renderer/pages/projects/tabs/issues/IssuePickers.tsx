import type { IssuePriority, IssueStatus } from "@tesseract/protocol";
import { ChoiceDropdown } from "../../../../components/ChoiceDropdown";
import { ASSIGNEE_OPTIONS, PRIORITY_CHOICES, STATUS_CHOICES } from "./choices";
import { CREATE_LABELS as L } from "./labels";
import type { AssigneeChoice } from "./types";

export interface IssuePickersProps {
  status: IssueStatus;
  priority: IssuePriority;
  assignee: AssigneeChoice;
  onStatus(status: IssueStatus): void;
  onPriority(priority: IssuePriority): void;
  onAssignee(assignee: AssigneeChoice): void;
  className?: string;
}

export function StatusPicker({ value, onChange, className }: { value: IssueStatus; onChange(status: IssueStatus): void; className?: string }) {
  return <ChoiceDropdown options={STATUS_CHOICES} value={value} onChange={onChange} ariaLabel={L.status} tooltip={L.status} className={className} />;
}

export function PriorityPicker({ value, onChange, className }: { value: IssuePriority; onChange(priority: IssuePriority): void; className?: string }) {
  return <ChoiceDropdown options={PRIORITY_CHOICES} value={value} onChange={onChange} ariaLabel={L.priority} tooltip={L.priority} className={className} />;
}

export function AssigneePicker({ value, onChange, className }: { value: AssigneeChoice; onChange(assignee: AssigneeChoice): void; className?: string }) {
  return <ChoiceDropdown options={ASSIGNEE_OPTIONS} value={value} onChange={onChange} ariaLabel={L.assignee} tooltip={L.assignee} className={className} />;
}

export function IssuePickers({ status, priority, assignee, onStatus, onPriority, onAssignee, className }: IssuePickersProps) {
  return (
    <>
      <StatusPicker value={status} onChange={onStatus} className={className} />
      <PriorityPicker value={priority} onChange={onPriority} className={className} />
      <AssigneePicker value={assignee} onChange={onAssignee} className={className} />
    </>
  );
}
