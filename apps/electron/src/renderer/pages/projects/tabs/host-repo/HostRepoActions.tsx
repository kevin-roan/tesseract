import { useRef } from "react";
import { ActionButton } from "../../../../components/ActionButton";
import { Floating, MenuSeparator, useActionMenu } from "../../../../components/ActionMenu";
import { HostUnlockDialog } from "../../../../components/HostUnlockDialog";
import { Text } from "../../../../components/Text";
import { TextField } from "../../../../components/TextField";
import type { NoticeAction } from "../../../../features/projects/types";
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
  return (
    <>
      <ActionButton
        label={repo.shell.label}
        icon={repo.shell.icon}
        busy={repo.shell.busy}
        disabled={repo.shell.disabled}
        tooltip={repo.shell.tooltip}
        onClick={() => repo.run("shell")}
      />
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
      <HostUnlockDialog open={repo.unlockOpen} onUnlock={repo.unlock} onClose={repo.closeUnlock} onUnlocked={repo.onUnlocked} />
    </>
  );
}
