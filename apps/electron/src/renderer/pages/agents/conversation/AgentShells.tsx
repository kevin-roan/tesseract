import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import { Icon } from "../../../components/Icon";
import { LogPanel } from "../../../components/LogPanel";
import { RecordRow } from "../../../components/RecordRow";
import { Reveal } from "../../../components/Reveal";
import { Text } from "../../../components/Text";
import { ToneDot } from "../../../components/ToneDot";
import { AGENT_SHELLS_LABELS as L } from "../../../features/agents/labels";
import { cx } from "../../../lib/cx";
import { reveal } from "../../../theme/motion";
import { useAgentShells } from "./use-agent-shells";
import styles from "./Conversation.module.css";

export interface AgentShellsProps {
  runId: string | null;
  running: boolean;
  active: boolean;
}

export function AgentShells({ runId, running, active }: AgentShellsProps) {
  const { shells, runningCount, open, lines, truncated, toggle, close } = useAgentShells(runId, running, active);
  const [expanded, setExpanded] = useState(true);
  const listId = useId();
  return (
    <AnimatePresence initial={false}>
      {shells.length > 0 ? (
        <motion.div key="shells" className={cx(styles.dock, styles.shellDock)} variants={reveal} initial="initial" animate="animate" exit="exit">
          <section className={styles.running} aria-label={L.title} data-open={expanded || undefined}>
            <button
              type="button"
              className={styles.runningToggle}
              aria-expanded={expanded}
              aria-controls={listId}
              aria-label={expanded ? L.hide : L.show}
              onClick={() => setExpanded((value) => !value)}
            >
              <ToneDot tone="success" size={7} live={runningCount > 0} />
              <Text variant="label" className={styles.runningSummary}>
                {L.summary(runningCount)}
              </Text>
              <Icon name="caret-down" className={styles.runningCaret} />
            </button>
            <Reveal open={expanded} id={listId}>
              <div className={styles.runningRows}>
                {shells.map((shell) => {
                  const logOpen = shell.id === open?.id;
                  return (
                    <RecordRow
                      key={shell.id}
                      icon="terminal"
                      title={shell.command}
                      monospaceTitle
                      selected={logOpen}
                      status={shell.running ? { label: L.running, tone: "success", live: true } : { label: L.ended, tone: "neutral" }}
                      actions={[{ id: "logs", icon: "terminal", label: logOpen ? L.hideLog : L.viewLog, active: logOpen, labeled: true, onActivate: () => toggle(shell.id) }]}
                      onActivate={() => toggle(shell.id)}
                    />
                  );
                })}
              </div>
              {open ? (
                <LogPanel
                  className={styles.shellLog}
                  title={open.command}
                  lines={lines}
                  notice={truncated ? L.logTruncated : null}
                  emptyLabel={L.logEmpty}
                  minHeight={120}
                  onClose={close}
                />
              ) : null}
            </Reveal>
          </section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
