import type { IssueStatus } from "@tesseract/protocol";

import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors } from "@/lib/tone";
import { IconSize } from "@/theme";

import { ISSUE_STATUS_ICONS, ISSUE_STATUS_TONES } from "../../utils/content";

export type IssueStatusIconProps = {
  status: IssueStatus;
  size?: number;
};

const IssueStatusIcon = ({ status, size = IconSize.sm }: IssueStatusIconProps) => {
  const theme = useAppTheme();
  const StatusIcon = ISSUE_STATUS_ICONS[status];
  return (
    <StatusIcon
      size={size}
      color={theme.colors[ToneColors[ISSUE_STATUS_TONES[status]].foreground]}
      weight={status === "done" || status === "canceled" ? "fill" : "bold"}
    />
  );
};

export default IssueStatusIcon;
