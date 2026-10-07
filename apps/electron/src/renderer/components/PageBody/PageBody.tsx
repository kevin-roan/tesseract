import { useRef, type CSSProperties, type ReactNode, type Ref } from "react";
import { cx } from "../../lib/cx";
import { OverlayScrollbar, useMergedRef } from "../OverlayScrollbar";
import { SECTION_GAP } from "./constants";
import styles from "./PageBody.module.css";

export interface PageBodyProps {
  children?: ReactNode;
  gap?: number;
  maxWidth?: number;
  label?: string;
  className?: string;
  contentClassName?: string;
  scrollRef?: Ref<HTMLDivElement>;
}

export function PageBody({ children, gap = SECTION_GAP, maxWidth, label, className, contentClassName, scrollRef }: PageBodyProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const ref = useMergedRef(scrollerRef, scrollRef);
  const style: CSSProperties = { gap, ...(maxWidth === undefined ? {} : { maxWidth }) };
  return (
    <div className={styles.frame}>
      <div ref={ref} className={cx(styles.scroll, className)} aria-label={label} role={label ? "region" : undefined}>
        <div className={cx(styles.page, maxWidth !== undefined && styles.clamped, contentClassName)} style={style}>
          {children}
        </div>
      </div>
      <OverlayScrollbar target={scrollerRef} />
    </div>
  );
}
