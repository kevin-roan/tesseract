import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { rise } from "../../theme/motion";
import { Text } from "../Text";
import { ERROR_SEPARATOR } from "./constants";
import styles from "./FormDialog.module.css";

export interface FieldGroupProps {
  title?: string;
  description?: string | null;
  errors?: readonly (string | null | undefined)[];
  children?: ReactNode;
}

export function FieldGroup({ title, description, errors = [], children }: FieldGroupProps) {
  const message = errors.filter(Boolean).join(ERROR_SEPARATOR);
  return (
    <div className={styles.group}>
      {title ? <Text variant="label">{title}</Text> : null}
      <div className={styles.fields}>{children}</div>
      {description ? (
        <Text variant="caption" color="text-secondary" wrap lines={null}>
          {description}
        </Text>
      ) : null}
      <AnimatePresence initial={false}>
        {message ? (
          <motion.div key="errors" className={styles.groupErrors} variants={rise} initial="initial" animate="animate" role="alert">
            <Text variant="caption" color="danger" wrap lines={null}>
              {message}
            </Text>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
