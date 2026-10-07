import { useEffect, useRef } from "react";
import { SearchField } from "../../../components/SearchField";
import { LIST_LABELS } from "../../../features/agents/labels";
import styles from "./ConversationList.module.css";

export interface SearchRowProps {
  value: string;
  focusToken: number;
  onChange(value: string): void;
  onStop(): void;
}

export function SearchRow({ value, focusToken, onChange, onStop }: SearchRowProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [focusToken]);
  return (
    <div className={styles.searchRow}>
      <SearchField value={value} onChange={onChange} onStop={onStop} placeholder={LIST_LABELS.search} inputRef={inputRef} />
    </div>
  );
}
