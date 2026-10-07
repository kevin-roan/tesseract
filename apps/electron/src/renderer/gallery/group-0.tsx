import type { ReactNode } from "react";
import { cx } from "../lib/cx";
import styles from "./group-0.module.css";

export interface GalleryLayoutProps {
  children: ReactNode;
  className?: string;
}

export function GalleryColumn({ children, className }: GalleryLayoutProps) {
  return <div className={cx(styles.column, className)}>{children}</div>;
}

export function GalleryRow({ caption, children, className }: GalleryLayoutProps & { caption?: string }) {
  return (
    <div className={cx(styles.row, className)}>
      {caption ? <span className={styles.caption}>{caption}</span> : null}
      {children}
    </div>
  );
}

export function GalleryStage({ children, tall = false, className }: GalleryLayoutProps & { tall?: boolean }) {
  return <div className={cx(styles.stage, tall && styles.tall, className)}>{children}</div>;
}

export function GalleryGrid({ children }: GalleryLayoutProps) {
  return <div className={styles.grid}>{children}</div>;
}

export function GalleryCell({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className={styles.cell} title={name}>
      {children}
      <span className={styles.cellName}>{name}</span>
    </div>
  );
}

export const galleryStyles = styles;
