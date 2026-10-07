import { AnimatePresence, motion } from "motion/react";
import type { Ref } from "react";
import { popover } from "../../theme/motion";
import { Icon } from "../Icon";
import { IconButton } from "../IconButton";
import { TextField, type TextFieldProps } from "../TextField";
import { SEARCH_ICON_SIZE } from "./constants";
import { SEARCH_FIELD_LABELS } from "./labels";
import { useSearchField } from "./use-search-field";
import styles from "./SearchField.module.css";

export interface SearchFieldProps
  extends Omit<TextFieldProps, "onChange" | "onSubmit" | "password" | "leading" | "trailing" | "type" | "inputRef"> {
  onChange(value: string): void;
  onSearch?(value: string): void;
  onStop?(): void;
  debounceMs?: number;
  inputRef?: Ref<HTMLInputElement>;
}

export function SearchField({
  value,
  onChange,
  onSearch,
  onStop,
  debounceMs,
  size = "sm",
  placeholder,
  disabled,
  inputRef,
  ...rest
}: SearchFieldProps) {
  const search = useSearchField({ value, onChange, onSearch, onStop, debounceMs });
  return (
    <TextField
      {...rest}
      inputRef={inputRef}
      type="search"
      role="searchbox"
      aria-label={rest["aria-label"] ?? placeholder ?? SEARCH_FIELD_LABELS.search}
      value={value}
      size={size}
      placeholder={placeholder}
      disabled={disabled}
      onChange={search.change}
      onSubmit={search.submit}
      onKeyDown={search.onKeyDown}
      leading={<Icon name="search" size={SEARCH_ICON_SIZE} className={styles.glyph} />}
      trailing={
        <AnimatePresence initial={false}>
          {search.hasValue ? (
            <motion.span key="clear" className={styles.clear} variants={popover} initial="initial" animate="animate" exit="exit">
              <IconButton icon="close" label={SEARCH_FIELD_LABELS.clear} size={22} disabled={disabled} onClick={search.clear} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      }
    />
  );
}
