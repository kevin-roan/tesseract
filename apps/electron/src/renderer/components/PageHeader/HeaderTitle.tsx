import { cx } from "../../lib/cx";
import { Icon } from "../Icon";
import { Crossfade } from "../Presence";
import { Text } from "../Text";
import styles from "./PageHeader.module.css";

export interface HeaderTitleProps {
  title: string;
  parent?: string | null;
  onParentClick?: () => void;
  animate?: boolean;
  className?: string;
}

function Breadcrumb({ title, parent, onParentClick }: Omit<HeaderTitleProps, "animate" | "className">) {
  return (
    <span className={styles.breadcrumb}>
      {parent ? (
        <>
          {onParentClick ? (
            <button type="button" className={styles.parentButton} onClick={onParentClick}>
              <Text variant="label" color="text-secondary">
                {parent}
              </Text>
            </button>
          ) : (
            <Text variant="label" color="text-secondary" className={styles.parent}>
              {parent}
            </Text>
          )}
          <Icon name="caret-right" size={10} color="text-tertiary" className={styles.separator} />
        </>
      ) : null}
      <Text variant="label" color="text" className={styles.title} title={title}>
        {title}
      </Text>
    </span>
  );
}

export function HeaderTitle({ title, parent = null, onParentClick, animate = true, className }: HeaderTitleProps) {
  const crumb = <Breadcrumb title={title} parent={parent} onParentClick={onParentClick} />;
  return (
    <div className={cx(styles.headerTitle, className)} data-testid="header-title">
      {animate ? (
        <Crossfade id={`${parent ?? ""}\u0000${title}`} speed="fast" className={styles.crossfade}>
          {crumb}
        </Crossfade>
      ) : (
        crumb
      )}
    </div>
  );
}
