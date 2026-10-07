import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { CopyButton } from "../../../components/CopyButton";
import { Icon } from "../../../components/Icon";
import { LogView, type LogLine } from "../../../components/LogView";
import { Reveal } from "../../../components/Reveal";
import { LOG_DISCLOSURE_HEIGHT } from "../constants";
import { SHELL_LABELS } from "../labels";
import { CHEVRON_OPEN_DEG, CHEVRON_TRANSITION } from "../motion";
import { toLogLines } from "./log-lines";
import styles from "./blocks.module.css";

export interface LogDisclosureProps {
  lines: readonly string[];
  defaultOpen?: boolean;
}

export function LogDisclosure({ lines, defaultOpen = false }: LogDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const logLines: LogLine[] = useMemo(() => toLogLines(lines), [lines]);
  return (
    <div className={styles.disclosure}>
      <div className={styles.disclosureBar}>
        <button type="button" className={styles.disclosureToggle} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <motion.span className={styles.chevron} animate={{ rotate: open ? CHEVRON_OPEN_DEG : 0 }} transition={CHEVRON_TRANSITION}>
            <Icon name="caret-right" />
          </motion.span>
          {open ? SHELL_LABELS.details.hide : SHELL_LABELS.details.show}
        </button>
        {open ? <CopyButton text={lines.join("\n")} copyLabel={SHELL_LABELS.details.copyLog} copiedLabel={SHELL_LABELS.copied} /> : null}
      </div>
      <Reveal open={open}>
        <div className={styles.logBox} style={{ height: LOG_DISCLOSURE_HEIGHT }}>
          <LogView lines={logLines} emptyLabel={SHELL_LABELS.details.empty} minHeight={0} />
        </div>
      </Reveal>
    </div>
  );
}
