import { useCallback, useState } from "react";

import { formatLabels, parseLabels, sameLabels } from "../utils/issues";

export function useIssueLabels(labels: readonly string[], save: (labels: string[]) => void) {
  const [text, setText] = useState<string | null>(null);

  const open = useCallback(() => setText(formatLabels(labels)), [labels]);
  const close = useCallback(() => setText(null), []);
  const submit = useCallback(() => {
    if (text === null) return;
    const next = parseLabels(text);
    setText(null);
    if (!sameLabels(next, labels)) save(next);
  }, [text, labels, save]);

  return {
    open,
    sheet: { visible: text !== null, text: text ?? "", setText, close, submit },
  };
}

export type IssueLabelsState = ReturnType<typeof useIssueLabels>["sheet"];
