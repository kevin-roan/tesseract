import { useCallback, useState, type KeyboardEvent } from "react";
import { addLabels, removeLabel } from "../model";

export function useLabelInput(labels: readonly string[], onChange: (labels: string[]) => void) {
  const [text, setText] = useState("");

  const commit = useCallback(() => {
    if (!text.trim()) return;
    onChange(addLabels(labels, text));
    setText("");
  }, [text, labels, onChange]);

  const remove = useCallback((label: string) => onChange(removeLabel(labels, label)), [labels, onChange]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" || event.key === ",") {
        event.preventDefault();
        commit();
      } else if (event.key === "Backspace" && text === "" && labels.length > 0) {
        remove(labels[labels.length - 1] as string);
      }
    },
    [commit, remove, text, labels],
  );

  return { text, setText, commit, remove, onKeyDown };
}
