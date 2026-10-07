import { AnimatePresence, motion } from "motion/react";
import { toast as toastMotion } from "../../theme/motion";
import { Toast } from "./Toast";
import { useToastHost } from "./use-toast-host";
import styles from "./Toast.module.css";

export interface ToastHostProps {
  scope?: string;
}

export function ToastHost({ scope = "window" }: ToastHostProps) {
  const { current, dismiss, timer } = useToastHost(scope);

  return (
    <div className={styles.host} aria-live="polite">
      <AnimatePresence mode="wait">
        {current ? (
          <motion.div
            key={current.id}
            className={styles.motion}
            variants={toastMotion}
            initial="initial"
            animate="animate"
            exit="exit"
            onPointerEnter={timer.pause}
            onPointerLeave={timer.resume}
          >
            <Toast message={current.message} action={current.action} onDismiss={() => dismiss(current.id)} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
