import { useId, type ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { Reveal } from "../Reveal";
import { Text } from "../Text";
import { SIDEBAR } from "./constants";
import { useDisclosure } from "./use-disclosure";
import styles from "./Sidebar.module.css";

export interface SidebarSectionProps {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

export function SidebarSection({ title, children, actions, open, defaultOpen = true, onOpenChange, className }: SidebarSectionProps) {
  const disclosure = useDisclosure({ open, defaultOpen, onOpenChange });
  const contentId = useId();
  return (
    <section className={cx(styles.group, className)} data-open={disclosure.open || undefined}>
      <div className={styles.sectionHeader}>
        <button
          type="button"
          className={styles.sectionToggle}
          aria-expanded={disclosure.open}
          aria-controls={contentId}
          onClick={disclosure.toggle}
        >
          <Text variant="overline" color="text-secondary" className={styles.sectionTitle}>
            {title}
          </Text>
          <span className={cx(styles.sectionCaret, !disclosure.open && styles.sectionCaretClosed)}>
            <Icon name="caret-down" size={SIDEBAR.caretSize} />
          </span>
        </button>
        <span className={styles.spacer} />
        {actions ? <div className={styles.sectionActions}>{actions}</div> : null}
      </div>
      <Reveal open={disclosure.open} id={contentId}>
        <div className={styles.sectionContent}>{children}</div>
      </Reveal>
    </section>
  );
}
