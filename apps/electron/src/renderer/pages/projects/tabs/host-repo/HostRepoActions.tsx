import { useRef } from "react";
import { ActionButton } from "../../../../components/ActionButton";
import { ActionGroup } from "../../../../components/ActionGroup";
import { Floating, MenuSeparator, useActionMenu } from "../../../../components/ActionMenu";
import { HostUnlockDialog } from "../../../../components/HostUnlockDialog";
import { Text } from "../../../../components/Text";
import { TextField } from "../../../../components/TextField";
import { Tooltip } from "../../../../components/Tooltip";
import type { NoticeAction } from "../../../../features/projects/types";
import { HOST_GROUP_ICON } from "./constants";
import { HostChatDialog } from "./HostChatDialog";
import { useHostRepo } from "./hooks/use-host-repo";
import { HOST_REPO_LABELS as L } from "./labels";
import type { HostRepoButton } from "./model";
import styles from "./HostRepoActions.module.css";

export interface HostRepoActionsProps {
  projectId: string;
  projectName: string;
  report(error: unknown, action?: NoticeAction): void;
}

export function HostRepoActions({ projectId, projectName, report }: HostRepoActionsProps) {
  const repo = useHostRepo({ projectId, projectName, report });
  const menu = useActionMenu();
  const gitRef = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    if (menu.open) menu.close();
    else if (gitRef.current) menu.openBelow(gitRef.current);
  };
  const actionButton = (button: HostRepoButton, variant: "primary" | "secondary", block = false) => (
    <ActionButton
      key={button.id}
      size="sm"
      variant={variant}
      block={block}
      label={button.label}
      icon={button.icon}
      busy={button.busy}
      disabled={button.disabled}
      tooltip={button.tooltip}
      onClick={() => repo.run(button.id)}
    />
  );
  if (repo.folder === null) {
    return (
      <ActionGroup label={L.group} icon={HOST_GROUP_ICON} tone="warning" muted>
        <Tooltip label={L.noCopy}>
          <Text variant="caption" color="text-tertiary">
            {L.notLinked}
          </Text>
        </Tooltip>
      </ActionGroup>
    );
  }
  const terminalButton = (button: HostRepoButton) => (
    <ActionButton
      key={button.id}
      label={button.label}
      icon={button.icon}
      busy={button.busy}
      disabled={button.disabled}
      tooltip={button.tooltip}
      onClick={() => repo.run(button.id)}
    />
  );
  return (
    <ActionGroup label={L.group} icon={HOST_GROUP_ICON} tone="warning" detail={repo.folder.name} detailTooltip={repo.folder.path}>
      {terminalButton(repo.claude)}
      {terminalButton(repo.shell)}
      <ActionButton
        ref={gitRef}
        label={repo.git.label}
        icon={repo.git.icon}
        busy={repo.git.busy}
        disabled={repo.git.disabled}
        tooltip={menu.open ? undefined : repo.git.tooltip}
        aria-haspopup="dialog"
        aria-expanded={menu.open}
        onClick={toggle}
      />
      <Floating
        open={menu.open && !repo.git.disabled}
        anchor={menu.anchor}
        onClose={menu.close}
        ignoreRef={gitRef}
        ariaLabel={L.git}
        role="dialog"
        className={styles.panel}
        bodyClassName={styles.body}
      >
        <Text variant="overline" color="text-tertiary" className={styles.header}>
          {L.git}
        </Text>
        <TextField
          size="sm"
          data-selected=""
          spellCheck
          value={repo.message}
          placeholder={L.messagePlaceholder}
          aria-label={L.messagePlaceholder}
          disabled={repo.git.busy}
          onChange={repo.setMessage}
          onSubmit={() => {
            if (!repo.commit.disabled) repo.run("commit");
          }}
        />
        {actionButton(repo.commit, "primary", true)}
        <MenuSeparator />
        <div className={styles.sync}>{repo.sync.map((button) => actionButton(button, "secondary", true))}</div>
      </Floating>
      <HostChatDialog open={repo.chat.open} client={repo.chat.client} projectId={projectId} folder={repo.folder.name} onClose={repo.chat.close} />
      <HostUnlockDialog open={repo.unlockOpen} onUnlock={repo.unlock} onClose={repo.closeUnlock} onUnlocked={repo.onUnlocked} />
    </ActionGroup>
  );
}
