import type { RadioChoice } from "../RadioRows";

export const PREFERENCE_GALLERY = {
  groupTitle: "Connection",
  groupDescription: "How the app reaches the sandbox controller.",
  apiUrl: "API URL",
  forgetTitle: "Forget this sandbox",
  forgetSubtitle: "Remove the saved URL and token.",
  forgetLabel: "Forget",
  imageTitle: "Image",
  imageValue: "ghcr.io/tesseract/sandbox:latest",
  rediscover: "Rediscover",
  save: "Save",
  serveTitle: "Serve host shell",
  serveSubtitle: "Running outside Tesseract · https://archlinux.tail511d9d.ts.net:8443",
  autostartTitle: "Start with Tesseract",
  autostartSubtitle: "Start serving whenever Tesseract opens",
  logTitle: "Log",
  logLine: "host shell listening on 127.0.0.1:7701",
  logLineTitle: "Last event",
  tokenTitle: "Token",
  tokenValue: "tok_5f1c0d",
} as const;

export const PREFERENCE_REFERENCE_WIDTH = 952;

export type AppearanceChoiceId = "dark" | "light";

export const APPEARANCE_CHOICES: readonly RadioChoice<AppearanceChoiceId>[] = [
  { id: "dark", title: "Dark", subtitle: "Graphite, like Linear" },
  { id: "light", title: "Light" },
];
