import type { LogInput } from "./model";

export const LOG_SAMPLE_LINES: LogInput[] = [
  { text: "$ pnpm exec expo run:android", stream: "system", seq: 1 },
  { text: "› Building app...", stream: "stdout", seq: 2 },
  { text: "\u001b[32m✔\u001b[39m Config synced", stream: "stdout", seq: 3 },
  { text: "Downloading 34% \r Downloading 67% \r Downloading 100%", stream: "stdout", seq: 4 },
  { text: "warning: Gradle daemon is busy, waiting", stream: "stderr", seq: 5 },
  { text: "\u001b[1m\u001b[33mBUILD\u001b[0m \u001b[36m:app:compileDebugKotlin\u001b[0m", stream: "stdout", seq: 6 },
  { text: "src/App.tsx(14,3): error TS2322: Type 'string' is not assignable to type 'number'.", stream: "stderr", seq: 7 },
  { text: "TypeError: Cannot read properties of undefined (reading 'map')", stream: "stderr", seq: 8 },
  { text: "    at render (/workspace/projects/streaxfit/src/screens/Home.tsx:42:18)", stream: "stderr", seq: 9 },
  { text: "Process exited with code 1", stream: "system", seq: 10 },
  {
    text: "A long line that wraps: /workspace/projects/streaxfit/node_modules/.pnpm/react-native@0.81.0/node_modules/react-native/ReactAndroid/build.gradle",
    stream: "stdout",
    seq: 11,
  },
];

export const LOG_PANEL_SAMPLES = {
  liveTitle: "expo-android (Android emulator)",
  endedTitle: "android:assembleRelease",
  action: "Restart",
  exitCode: 1,
  liveMinHeight: 200,
  endedMinHeight: 120,
} as const;
