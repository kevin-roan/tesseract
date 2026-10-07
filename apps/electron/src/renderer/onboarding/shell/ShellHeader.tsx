import { Icon } from "../../components/Icon";
import { Crossfade } from "../../components/Presence";
import { Text } from "../../components/Text";
import { cx } from "../../lib/cx";
import { WindowControls } from "../../components/WindowControls";
import { SHELL_LABELS } from "./labels";
import styles from "./ShellHeader.module.css";

export interface ShellHeaderProps {
  title: string;
  index: number;
  total: number;
  showWindowControls: boolean;
}

export function ShellHeader({ title, index, total, showWindowControls }: ShellHeaderProps) {
  return (
    <header className={cx(styles.header, "to-drag")}>
      <div className={styles.breadcrumb}>
        <Icon name="settings" color="text-secondary" />
        <Text variant="bodyStrong" color="text-secondary">
          {SHELL_LABELS.setUp}
        </Text>
        <Icon name="caret-right" color="text-tertiary" />
        <Crossfade id={title} inline className={styles.title}>
          <Text variant="bodyStrong">{title}</Text>
        </Crossfade>
      </div>
      <div className={cx(styles.end, "to-no-drag")}>
        <Text variant="caption" color="text-tertiary" tabular>
          {SHELL_LABELS.stepOf(index + 1, total)}
        </Text>
        {showWindowControls ? (
          <>
            <span className={styles.separator} aria-hidden />
            <WindowControls />
          </>
        ) : null}
      </div>
    </header>
  );
}
