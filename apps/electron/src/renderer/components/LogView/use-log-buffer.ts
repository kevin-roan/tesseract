import { useCallback, useMemo, useReducer } from "react";
import { LOG_DEFAULT_MAX_LINES } from "./constants";
import { appendLog, EMPTY_LOG_STATE, type LogInput, type LogState } from "./model";

type Action =
  | { type: "append"; inputs: readonly (LogInput | string)[]; stream: string; maxLines: number }
  | { type: "set"; inputs: readonly (LogInput | string)[]; maxLines: number }
  | { type: "clear" };

function reducer(state: LogState, action: Action): LogState {
  switch (action.type) {
    case "append":
      return appendLog(state, action.inputs, action.maxLines, action.stream);
    case "set":
      return appendLog({ ...EMPTY_LOG_STATE, nextId: state.nextId }, action.inputs, action.maxLines);
    case "clear":
      return { ...EMPTY_LOG_STATE, nextId: state.nextId };
  }
}

export function useLogBuffer(maxLines: number = LOG_DEFAULT_MAX_LINES) {
  const [state, dispatch] = useReducer(reducer, EMPTY_LOG_STATE);

  const appendLines = useCallback(
    (inputs: readonly (LogInput | string)[], stream = "stdout") => dispatch({ type: "append", inputs, stream, maxLines }),
    [maxLines],
  );
  const appendLine = useCallback(
    (input: LogInput | string, stream = "stdout") => dispatch({ type: "append", inputs: [input], stream, maxLines }),
    [maxLines],
  );
  const setLines = useCallback(
    (inputs: readonly (LogInput | string)[]) => dispatch({ type: "set", inputs, maxLines }),
    [maxLines],
  );
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  return useMemo(
    () => ({ lines: state.lines, appendLine, appendLines, setLines, clear }),
    [state.lines, appendLine, appendLines, setLines, clear],
  );
}

export type LogBuffer = ReturnType<typeof useLogBuffer>;
