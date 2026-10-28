import { ActionButton } from "../../../../components/ActionButton";
import { ChipGroup } from "../../../../components/Chip";
import { ListToolbar } from "../../../../components/ListToolbar";
import { SegmentedControl } from "../../../../components/SegmentedControl";
import { LAYOUT_CHOICES, SCOPE_CHOICES } from "./choices";
import { CREATE_ISSUE_KEY } from "./constants";
import { ISSUES_LABELS as L } from "./labels";
import type { IssueLayout, IssueScope } from "./types";

export interface IssuesToolbarProps {
  scope: IssueScope;
  layout: IssueLayout;
  onScope(scope: IssueScope): void;
  onLayout(layout: IssueLayout): void;
  onCreate(): void;
}

export function IssuesToolbar({ scope, layout, onScope, onLayout, onCreate }: IssuesToolbarProps) {
  return (
    <ListToolbar
      label={L.toolbar}
      start={<ChipGroup options={SCOPE_CHOICES} value={scope} onChange={onScope} ariaLabel={L.scope} size="filter" spacing="compact" />}
      end={
        <>
          <SegmentedControl options={LAYOUT_CHOICES} value={layout} onChange={onLayout} ariaLabel={L.layout} />
          <ActionButton variant="primary" size="sm" icon="add" label={L.newIssue} shortcut={CREATE_ISSUE_KEY.toUpperCase()} onClick={onCreate} />
        </>
      }
    />
  );
}
