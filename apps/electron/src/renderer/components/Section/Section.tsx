import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Spinner } from "../Spinner";
import { Text } from "../Text";
import { CrossfadeStack } from "./CrossfadeStack";
import { SectionHeader, type SectionHeaderProps } from "./SectionHeader";
import { viewState } from "./view-state";
import styles from "./Section.module.css";

export interface SectionProps extends Omit<SectionHeaderProps, "className"> {
  children?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
  className?: string;
}

export function Section({ children, loading, empty, emptyLabel, loadingLabel, className, ...header }: SectionProps) {
  const view = viewState(loading, empty);
  return (
    <section className={cx(styles.section, className)} aria-busy={view === "loading" || undefined}>
      <SectionHeader {...header} />
      <CrossfadeStack view={view}>
        {view === "loading" ? (
          <Spinner size={16} label={loadingLabel} />
        ) : view === "empty" ? (
          <Text variant="bodySmall" color="text-secondary" wrap lines={null}>
            {emptyLabel}
          </Text>
        ) : (
          <div className={styles.content}>{children}</div>
        )}
      </CrossfadeStack>
    </section>
  );
}
