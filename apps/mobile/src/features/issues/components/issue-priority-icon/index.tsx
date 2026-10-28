import type { IssuePriority } from "@tesseract/protocol";

import { useAppTheme } from "@/hooks/use-app-theme";
import { ToneColors } from "@/lib/tone";
import { IconSize } from "@/theme";

import { ISSUE_PRIORITY_ICONS, ISSUE_PRIORITY_TONES } from "../../utils/content";

export type IssuePriorityIconProps = {
  priority: IssuePriority;
  size?: number;
};

const IssuePriorityIcon = ({ priority, size = IconSize.sm }: IssuePriorityIconProps) => {
  const theme = useAppTheme();
  const PriorityIcon = ISSUE_PRIORITY_ICONS[priority];
  return (
    <PriorityIcon
      size={size}
      color={theme.colors[ToneColors[ISSUE_PRIORITY_TONES[priority]].foreground]}
      weight={priority === "urgent" ? "fill" : "bold"}
    />
  );
};

export default IssuePriorityIcon;
