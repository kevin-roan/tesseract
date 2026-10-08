import type { AgentRun } from "@tesseract/protocol";
import { useRef, type ReactNode } from "react";
import { ActionButton } from "../../../components/ActionButton";
import { ActionMenu, useActionMenu, type MenuSections } from "../../../components/ActionMenu";
import { Icon } from "../../../components/Icon";
import { IconButton } from "../../../components/IconButton";
import { Text } from "../../../components/Text";
import { CONVERSATION_LABELS, MANAGE_LABELS } from "../../../features/agents/labels";
import type { HeaderActions, ManageAction } from "./model";
import { RunStateGlyph } from "./RunStateGlyph";
import styles from "./Conversation.module.css";

export interface ConversationHeaderProps {
  run: AgentRun | null;
  title: string;
  project: string;
  actions: HeaderActions;
  sections: MenuSections;
  stopping: boolean;
  sync?: ReactNode;
  onStop(): void;
  onOpenTerminal(terminalId: string): void;
  onManage(action: ManageAction): void;
}

export function ConversationHeader({
  run,
  title,
  project,
  actions,
  sections,
  stopping,
  sync,
  onStop,
  onOpenTerminal,
  onManage,
}: ConversationHeaderProps) {
  const menu = useActionMenu();
  const moreRef = useRef<HTMLSpanElement>(null);
  const { terminalId } = actions;
  return (
    <header className={styles.header}>
      <div className={styles.headerStart}>
        {run ? <RunStateGlyph state={run.state} /> : null}
        <Text variant="label" color="text-secondary" className={styles.headerProject} title={project}>
          {project}
        </Text>
        {run ? <Icon name="caret-right" color="text-tertiary" className={styles.headerCaret} /> : null}
        <Text variant="label" className={styles.headerTitle} title={title}>
          {title}
        </Text>
      </div>
      <div className={styles.headerEnd}>
        {actions.stop ? (
          <ActionButton
            label={CONVERSATION_LABELS.cancel}
            icon="stop"
            variant="secondary"
            tooltip={CONVERSATION_LABELS.cancelTooltip}
            disabled={stopping}
            className={styles.stopButton}
            onClick={onStop}
          />
        ) : null}
        {terminalId ? (
          <IconButton icon="terminal" label={CONVERSATION_LABELS.openTerminal} onClick={() => onOpenTerminal(terminalId)} />
        ) : null}
        {actions.sync && sync ? <div className={styles.sync}>{sync}</div> : null}
        {actions.archive ? <IconButton icon="archive" label={MANAGE_LABELS.archive} onClick={() => onManage("archive")} /> : null}
        {actions.unarchive ? <IconButton icon="unarchive" label={MANAGE_LABELS.unarchive} onClick={() => onManage("unarchive")} /> : null}
        <span ref={moreRef} className={styles.more}>
          <IconButton
            icon="more"
            label={CONVERSATION_LABELS.more}
            checked={menu.open}
            disabled={!run}
            onClick={(event) => (menu.open ? menu.close() : menu.openBelow(event.currentTarget))}
          />
        </span>
        <ActionMenu anchor={menu.anchor} sections={sections} onClose={menu.close} ariaLabel={CONVERSATION_LABELS.more} ignoreRef={moreRef} />
      </div>
    </header>
  );
}
