import { ActionButton } from "../../../components/ActionButton";
import { ActionMenu, useActionMenu } from "../../../components/ActionMenu";
import { useProjectDevices } from "../../../features/emulator/hooks/use-project-devices";
import { DEVICE_WINDOW_LABELS } from "../../../features/emulator/labels";
import { cx } from "../../../lib/cx";
import styles from "./Conversation.module.css";

export interface ConversationDevicesProps {
  projectId: string;
  compact: boolean;
}

export function ConversationDevices({ projectId, compact }: ConversationDevicesProps) {
  const { kinds, open } = useProjectDevices(projectId);
  const menu = useActionMenu();
  const [only, ...others] = kinds;
  if (!only) return null;
  return (
    <>
      <ActionButton
        label={DEVICE_WINDOW_LABELS.button}
        icon="smartphone"
        tooltip={DEVICE_WINDOW_LABELS.tooltip}
        aria-label={DEVICE_WINDOW_LABELS.button}
        className={cx(styles.syncButton, compact && styles.syncCompact)}
        onClick={(event) => {
          if (others.length === 0) open(only);
          else if (menu.open) menu.close();
          else menu.openBelow(event.currentTarget);
        }}
      />
      <ActionMenu
        anchor={menu.anchor}
        sections={[kinds.map((kind) => ({ id: kind.id, label: kind.label, icon: kind.icon, onSelect: () => open(kind) }))]}
        onClose={menu.close}
        ariaLabel={DEVICE_WINDOW_LABELS.button}
      />
    </>
  );
}
