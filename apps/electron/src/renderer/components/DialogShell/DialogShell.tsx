import { AnimatePresence, motion } from "motion/react";
import { useId, useRef, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cx } from "../../lib/cx";
import { dialog as sheetMotion, fade } from "../../theme/motion";
import { IconButton } from "../IconButton";
import { OverlayScrollbar } from "../OverlayScrollbar";
import { ToastHost } from "../Toast";
import { Breadcrumb, type DialogContext } from "./Breadcrumb";
import { DIALOG_WIDTH } from "./constants";
import { DIALOG_LABELS } from "./labels";
import { useDialogBehavior, type InitialFocus } from "./use-dialog-behavior";
import styles from "./DialogShell.module.css";

export type DialogPresentation = "modal" | "inline";
export type DialogVariant = "default" | "confirm";

export interface DialogShellProps {
  title: string;
  onClose(): void;
  open?: boolean;
  context?: DialogContext | null;
  width?: number;
  variant?: DialogVariant;
  presentation?: DialogPresentation;
  onExpand?: () => void;
  headerTrailing?: ReactNode;
  footerStart?: ReactNode;
  footerEnd?: ReactNode;
  onSubmit?: () => void;
  toastScope?: string;
  initialFocus?: InitialFocus;
  role?: "dialog" | "alertdialog";
  describedBy?: string;
  className?: string;
  bodyClassName?: string;
  onExitComplete?: () => void;
  children?: ReactNode;
}

export function DialogShell({
  title,
  onClose,
  open = true,
  context,
  width = DIALOG_WIDTH,
  variant = "default",
  presentation = "modal",
  onExpand,
  headerTrailing,
  footerStart,
  footerEnd,
  onSubmit,
  toastScope,
  initialFocus,
  role = "dialog",
  describedBy,
  className,
  bodyClassName,
  onExitComplete,
  children,
}: DialogShellProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const modal = presentation === "modal";
  useDialogBehavior({ active: open && modal, sheetRef, onClose, initialFocus });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.();
  };

  const content = (
    <>
      <header className={cx(styles.header, variant === "confirm" && styles.confirmHeader)}>
        <Breadcrumb title={title} titleId={titleId} context={variant === "confirm" ? null : context} />
        <div className={styles.trailing}>
          {headerTrailing}
          {onExpand ? (
            <IconButton icon="fullscreen" label={DIALOG_LABELS.expand} size={24} onClick={onExpand} />
          ) : null}
          <IconButton icon="close" label={DIALOG_LABELS.close} size={24} onClick={onClose} />
        </div>
      </header>
      <div ref={bodyRef} className={cx(styles.body, bodyClassName)}>
        {children}
      </div>
      <OverlayScrollbar target={bodyRef} />
      {footerStart || footerEnd ? (
        <footer className={styles.footer}>
          <div className={styles.footerStart}>{footerStart}</div>
          <div className={styles.footerEnd}>{footerEnd}</div>
        </footer>
      ) : null}
    </>
  );

  const sheet = (
    <motion.div
      ref={sheetRef}
      className={cx(styles.sheet, !modal && styles.inline, className)}
      style={{ "--dialog-width": `${width}px` } as CSSProperties}
      role={role}
      aria-modal={modal || undefined}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      tabIndex={-1}
      variants={modal ? sheetMotion : undefined}
      data-dialog-sheet=""
    >
      {onSubmit ? (
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {content}
        </form>
      ) : (
        content
      )}
      {toastScope ? <ToastHost scope={toastScope} /> : null}
    </motion.div>
  );

  if (!modal) return open ? sheet : null;

  return createPortal(
    <AnimatePresence onExitComplete={onExitComplete}>
      {open ? (
        <motion.div
          key="dialog-layer"
          className={cx(styles.layer, "to-no-drag")}
          variants={fade}
          initial="initial"
          animate="animate"
          exit="exit"
          data-dialog-layer=""
        >
          {sheet}
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
