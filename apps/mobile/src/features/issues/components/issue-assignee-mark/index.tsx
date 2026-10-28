import type { IssueAssignee } from "@tesseract/protocol";

import ClaudeMark from "@/components/claude-mark";
import { useAppTheme } from "@/hooks/use-app-theme";
import { IconSize } from "@/theme";

import { ISSUE_ASSIGNEE_ICONS } from "../../utils/content";

export type IssueAssigneeMarkProps = {
  assignee: IssueAssignee | null;
  size?: number;
  testID?: string;
};

const IssueAssigneeMark = ({ assignee, size = IconSize.sm, testID }: IssueAssigneeMarkProps) => {
  const theme = useAppTheme();
  if (assignee === "claude") return <ClaudeMark size={size} testID={testID} />;
  const AssigneeIcon = ISSUE_ASSIGNEE_ICONS[assignee ?? "unassigned"];
  return <AssigneeIcon size={size} color={theme.colors[assignee ? "textSecondary" : "textTertiary"]} testID={testID} />;
};

export default IssueAssigneeMark;
