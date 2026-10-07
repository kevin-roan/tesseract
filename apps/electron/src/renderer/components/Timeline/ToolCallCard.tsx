import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { cx } from "../../lib/cx";
import { reveal } from "../../theme/motion";
import { Icon } from "../Icon";
import { Spinner } from "../Spinner";
import { Text } from "../Text";
import { ActivityRow } from "./ActivityRow";
import { ACTIVITY_SPINNER_SIZE } from "./constants";
import { toolSummaryLine } from "./initials";
import { TIMELINE_LABELS, type ToolCardLabels } from "./labels";
import styles from "./Timeline.module.css";

export type ToolStatus = "pending" | "ok" | "error" | (string & {});

export interface ToolCallCardProps {
  tool: string;
  summary: string;
  result?: string | null;
  status: ToolStatus;
  labels?: ToolCardLabels;
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}

function StatusGlyph({ status }: { status: ToolStatus }) {
  if (status === "pending") return <Spinner size={ACTIVITY_SPINNER_SIZE} />;
  if (status === "error") return <Icon name="failed" color="danger" />;
  return <Icon name="tool" color="text-tertiary" />;
}

export function ToolCallCard({
  tool,
  summary,
  result,
  status,
  labels = TIMELINE_LABELS.tool,
  expanded,
  defaultExpanded = false,
  onExpandedChange,
  className,
}: ToolCallCardProps) {
  const [localExpanded, setLocalExpanded] = useState(defaultExpanded);
  const open = expanded ?? localExpanded;
  const toggle = () => {
    setLocalExpanded(!open);
    onExpandedChange?.(!open);
  };
  return (
    <div className={cx(styles.toolCard, status === "error" && "error", className)} data-status={status}>
      <button type="button" className={styles.toolHeader} aria-expanded={open} onClick={toggle}>
        <ActivityRow glyph={<StatusGlyph status={status} />}>
          <Text variant="overline" color="text-secondary">
            {tool}
          </Text>
          <Text variant="caption" color="text-tertiary" className={styles.grow}>
            {toolSummaryLine(summary, result)}
          </Text>
          <span className={styles.toolChevron} data-open={open || undefined}>
            <Icon name="collapse" color="text-tertiary" />
          </span>
        </ActivityRow>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="details" className={styles.toolReveal} variants={reveal} initial="initial" animate="animate" exit="exit">
            <div className={styles.toolDetails}>
              {summary ? (
                <>
                  <Text variant="caption" color="text-tertiary">
                    {labels.input}
                  </Text>
                  <Text variant="code" wrap lines={null} selectable className={styles.preWrap}>
                    {summary}
                  </Text>
                </>
              ) : null}
              {result ? (
                <>
                  <Text variant="caption" color="text-tertiary">
                    {labels.output}
                  </Text>
                  <Text
                    variant="code"
                    color={status === "error" ? "danger" : "text-secondary"}
                    wrap
                    lines={null}
                    selectable
                    className={styles.preWrap}
                  >
                    {result}
                  </Text>
                </>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
