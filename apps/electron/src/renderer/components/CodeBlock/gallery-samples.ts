export const CODE_SAMPLES = [
  {
    language: "ts",
    code: `export function useLogBuffer(maxLines = 5000) {\n  const [state, dispatch] = useReducer(reducer, EMPTY_LOG_STATE);\n  return state.lines;\n}`,
  },
  {
    language: "",
    code: "pnpm exec expo run:android --device emulator-5554 --port 8081 --no-bundler --variant debug --verbose",
  },
] as const;
