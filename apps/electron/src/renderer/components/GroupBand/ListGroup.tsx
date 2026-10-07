import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { CrossfadeStack, viewState } from "../Section";
import { Spinner } from "../Spinner";
import { Text } from "../Text";
import { GroupBand, type GroupBandProps } from "./GroupBand";
import styles from "./GroupBand.module.css";

export interface ListGroupProps extends Omit<GroupBandProps, "className"> {
  children?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
  className?: string;
}

export function ListGroup({ children, loading, empty, emptyLabel, loadingLabel, className, ...band }: ListGroupProps) {
  const view = viewState(loading, empty);
  return (
    <section className={cx(styles.group, className)} aria-busy={view === "loading" || undefined}>
      <GroupBand {...band} />
      <CrossfadeStack view={view}>
        {view === "loading" ? (
          <div className={styles.placeholder}>
            <Spinner size={16} label={loadingLabel} />
          </div>
        ) : view === "empty" ? (
          <div className={styles.placeholder}>
            <Text variant="body" color="text-tertiary" wrap lines={null}>
              {emptyLabel}
            </Text>
          </div>
        ) : (
          <div className={styles.content}>{children}</div>
        )}
      </CrossfadeStack>
    </section>
  );
}
