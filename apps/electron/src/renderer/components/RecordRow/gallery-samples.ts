import type { RecordRowProps } from "./RecordRow";

const noop = (): void => undefined;

export interface RecordRowSample extends RecordRowProps {
  key: string;
}

export const RECORD_ROW_SAMPLES: readonly RecordRowSample[] = [
  {
    key: "dev",
    icon: "file",
    code: "1",
    codeTone: "info",
    title: "dev server",
    subtitle: "bun run dev",
    meta: "pid 123 · 2m",
    status: { label: "Running", tone: "success" },
    actions: [
      { id: "browser", icon: "browser", label: "Open in browser", onActivate: noop },
      { id: "stop", icon: "stop", label: "Stop", onActivate: noop, destructive: true },
    ],
    onActivate: noop,
  },
  {
    key: "build",
    title: "build web",
    subtitle: "vite build",
    status: { label: "Building", tone: "info", glyph: true },
    progress: 0.4,
    meta: "12s",
    actions: [
      { id: "run", icon: "play", label: "Run", onActivate: noop, labeled: true },
      { id: "stop", icon: "stop", label: "Stop", onActivate: noop },
    ],
  },
  {
    key: "long",
    icon: "file",
    title: "a very long title that keeps going and going and going for a while",
    meta: "meta",
  },
];

export const RECORD_ROW_EXTRA_SAMPLES: readonly RecordRowSample[] = [
  { key: "glyph-ok", title: "Release build", subtitle: "android · release", status: { label: "Succeeded", tone: "success", glyph: true }, meta: "3m ago" },
  { key: "glyph-fail", title: "Debug build", subtitle: "ios · debug", status: { label: "Failed", tone: "danger", glyph: true }, meta: "1h ago" },
  { key: "pending", icon: "builds", title: "Queued build", progress: null, meta: "waiting" },
  { key: "mono", icon: "commit", code: "M", codeTone: "warning", title: "src/app/index.tsx", monospaceTitle: true, meta: "+12 −3" },
];
