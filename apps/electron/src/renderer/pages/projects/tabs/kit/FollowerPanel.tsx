import { LogPanel, type LogPanelAction } from "../../../../components/LogPanel";
import { Reveal } from "../../../../components/Reveal";
import type { LogFollower } from "../../../../features/projects/hooks/use-log-follower";
import { LOG_LABELS } from "../../../../features/projects/labels";

export interface FollowerPanelProps {
  follower: LogFollower;
  title: string | null;
  action?: LogPanelAction | null;
  onClose: () => void;
}

export function FollowerPanel({ follower, title, action, onClose }: FollowerPanelProps) {
  return (
    <Reveal open={Boolean(follower.target && title)}>
      <LogPanel
        title={title ?? ""}
        lines={follower.lines}
        status={follower.status}
        notice={follower.notice}
        action={action}
        closeLabel={LOG_LABELS.close}
        emptyLabel={LOG_LABELS.waiting}
        jumpLabel={LOG_LABELS.jump}
        onClose={onClose}
      />
    </Reveal>
  );
}
