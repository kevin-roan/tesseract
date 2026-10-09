import { Fragment } from "react";
import styles from "./Breadcrumbs.module.css";

export interface Crumb {
  id: string;
  label: string;
}

export interface BreadcrumbsProps {
  crumbs: readonly Crumb[];
  label: string;
  onSelect(id: string): void;
}

export function Breadcrumbs({ crumbs, label, onSelect }: BreadcrumbsProps) {
  return (
    <nav className={styles.trail} aria-label={label}>
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <Fragment key={crumb.id}>
            {index > 0 ? <span className={styles.separator}>/</span> : null}
            <button
              type="button"
              className={styles.crumb}
              aria-current={last ? "location" : undefined}
              disabled={last}
              onClick={() => onSelect(crumb.id)}
            >
              {crumb.label}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
