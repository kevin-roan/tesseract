import type { ReactNode } from "react";
import { Checkbox } from "../../../components/Checkbox";
import { PreferenceRow } from "../../../components/PreferenceRows";
import { Text } from "../../../components/Text";
import styles from "./parts.module.css";

export interface ComponentRowProps {
  title: string;
  subtitle?: ReactNode;
  caption: string;
  checked: boolean;
  locked?: boolean;
  disabled?: boolean;
  onChange?(checked: boolean): void;
}

export function ComponentRow({
  title,
  subtitle,
  caption,
  checked,
  locked = false,
  disabled = false,
  onChange,
}: ComponentRowProps) {
  const inert = locked || disabled;
  return (
    <PreferenceRow
      title={title}
      subtitle={subtitle}
      disabled={disabled}
      data-locked={locked || undefined}
      className={locked ? styles.locked : undefined}
      onActivate={inert ? undefined : () => onChange?.(!checked)}
      role={inert ? undefined : "checkbox"}
      aria-checked={checked}
      prefix={
        <Checkbox
          checked={checked}
          disabled={inert}
          tabIndex={-1}
          ariaLabel={title}
          onChange={inert ? undefined : onChange}
          onClick={(event) => event.stopPropagation()}
        />
      }
      suffix={
        <Text variant="caption" color="text-tertiary" tabular className={styles.caption}>
          {caption}
        </Text>
      }
    />
  );
}
