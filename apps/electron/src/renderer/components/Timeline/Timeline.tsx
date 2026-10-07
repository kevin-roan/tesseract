import { motion } from "motion/react";
import { Children, isValidElement, useEffect, useImperativeHandle, useRef, type ReactNode, type Ref } from "react";
import { cx } from "../../lib/cx";
import { JumpButton, useFollowTail } from "../LogView";
import { OverlayScrollbar } from "../OverlayScrollbar";
import { TIMELINE_FOLLOW_THRESHOLD_PX, TIMELINE_ITEM_MOTION, TIMELINE_JUMP_BOTTOM_PX, TIMELINE_WIDTH } from "./constants";
import { TIMELINE_LABELS } from "./labels";
import { useInitialKeys } from "./use-initial-keys";
import styles from "./Timeline.module.css";

export interface TimelineHandle {
  jumpToEnd(): void;
}

export interface TimelineProps {
  children?: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  jumpLabel?: string;
  resetKey?: unknown;
  maxWidth?: number;
  className?: string;
  ref?: Ref<TimelineHandle>;
}

export function Timeline({
  children,
  header,
  footer,
  jumpLabel = TIMELINE_LABELS.jump,
  resetKey,
  maxWidth = TIMELINE_WIDTH,
  className,
  ref,
}: TimelineProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children).filter(isValidElement);
  const keys = items.map((item, index) => item.key ?? index);
  const initialKeys = useInitialKeys(keys, resetKey);
  const { detached, jumpToEnd } = useFollowTail({
    threshold: TIMELINE_FOLLOW_THRESHOLD_PX,
    scrollerRef,
    contentRef,
    changeKey: keys.join("|"),
  });
  useImperativeHandle(ref, () => ({ jumpToEnd }), [jumpToEnd]);
  useEffect(() => {
    jumpToEnd();
  }, [resetKey, jumpToEnd]);

  return (
    <div className={cx(styles.timeline, className)}>
      <div ref={scrollerRef} className={styles.scroller}>
        <div className={styles.column} style={{ maxWidth }}>
          <div ref={contentRef} className={styles.content}>
            <div className={styles.header}>{header}</div>
            <div className={styles.items}>
              {items.map((item, index) => {
                const key = keys[index] ?? index;
                return (
                  <motion.div
                    key={key}
                    className={styles.item}
                    variants={TIMELINE_ITEM_MOTION}
                    initial={initialKeys.has(key) ? false : "initial"}
                    animate="animate"
                  >
                    {item}
                  </motion.div>
                );
              })}
            </div>
            <div className={styles.footer}>{footer}</div>
          </div>
        </div>
      </div>
      <OverlayScrollbar target={scrollerRef} />
      <JumpButton visible={detached} label={jumpLabel} onClick={jumpToEnd} placement="center" offset={TIMELINE_JUMP_BOTTOM_PX} />
    </div>
  );
}
