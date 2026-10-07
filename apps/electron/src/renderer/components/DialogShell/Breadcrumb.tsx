import type { IconName } from "../../theme/icons";
import { Icon } from "../Icon";
import { Text } from "../Text";
import styles from "./DialogShell.module.css";

export interface DialogContext {
  label: string;
  icon?: IconName;
}

export interface BreadcrumbProps {
  title: string;
  titleId?: string;
  context?: DialogContext | null;
}

export function Breadcrumb({ title, titleId, context }: BreadcrumbProps) {
  return (
    <div className={styles.breadcrumb}>
      {context ? (
        <>
          <span className={styles.chip} data-testid="dialog-context">
            {context.icon ? <Icon name={context.icon} color="text-secondary" /> : null}
            <Text variant="bodyStrong" color="text-secondary">
              {context.label}
            </Text>
          </span>
          <Icon name="caret-right" color="text-tertiary" className={styles.caret} />
        </>
      ) : null}
      <h2 id={titleId} className={styles.title}>
        <Text variant="bodyStrong">{title}</Text>
      </h2>
    </div>
  );
}
