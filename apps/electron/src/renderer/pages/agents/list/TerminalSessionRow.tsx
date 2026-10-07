import type { ClaudeSession } from "@theone/protocol";
import { Icon } from "../../../components/Icon";
import { Text } from "../../../components/Text";
import { Tooltip } from "../../../components/Tooltip";
import { runTitle, terminalSessionMeta, type ProjectNames } from "../../../features/agents/model";
import { GLYPH_SIZE } from "../shared/constants";
import styles from "./ConversationList.module.css";

export interface TerminalSessionRowProps {
  session: ClaudeSession;
  names: ProjectNames;
  now: number;
  onOpen(terminalId: string): void;
}

export function TerminalSessionRow({ session, names, now, onOpen }: TerminalSessionRowProps) {
  const title = runTitle(session.title);
  return (
    <Tooltip label={title}>
      <button type="button" className={styles.terminalSession} onClick={() => session.terminalId && onOpen(session.terminalId)}>
        <span className={styles.cardGlyph}>
          <Icon name="terminal" size={GLYPH_SIZE} color="text-secondary" />
        </span>
        <span className={styles.rowText}>
          <Text variant="label">{title}</Text>
          <Text variant="caption" color="text-secondary">
            {terminalSessionMeta(session, names, now)}
          </Text>
        </span>
      </button>
    </Tooltip>
  );
}
