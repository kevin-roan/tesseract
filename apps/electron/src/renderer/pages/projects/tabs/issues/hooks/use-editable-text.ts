import { useCallback, useEffect, useState, type KeyboardEvent } from "react";

export function useEditableText(value: string, onCommit: (next: string) => void) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(value);
  }, [value, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    if (text !== value) onCommit(text);
  }, [text, value, onCommit]);

  const cancel = useCallback(() => {
    setEditing(false);
    setText(value);
  }, [value]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      event.currentTarget.blur();
    },
    [],
  );

  return { text, editing, setText, begin: () => setEditing(true), commit, cancel, onKeyDown };
}
