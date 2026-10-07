import { useId, type ReactNode } from "react";
import { Text } from "../Text";
import { FieldIdContext } from "./field-context";
import styles from "./FormDialog.module.css";

export interface FormFieldProps {
  label?: string;
  children: ReactNode;
}

export function FormField({ label, children }: FormFieldProps) {
  const id = useId();
  return (
    <div className={styles.field}>
      {label ? (
        <label htmlFor={id} className={styles.fieldLabel}>
          <Text variant="overline" color="text-secondary">
            {label}
          </Text>
        </label>
      ) : null}
      <FieldIdContext.Provider value={id}>{children}</FieldIdContext.Provider>
    </div>
  );
}
