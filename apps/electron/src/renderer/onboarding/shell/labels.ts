import { ONBOARDING_LABELS } from "../labels";

export const SHELL_LABELS = {
  setUp: ONBOARDING_LABELS.setUp,
  optional: ONBOARDING_LABELS.optional,
  stepOf: ONBOARDING_LABELS.stepOf,
  version: ONBOARDING_LABELS.version,
  railLabel: "Setup steps",
  buttons: {
    ...ONBOARDING_LABELS.buttons,
    install: "Install",
    installEllipsis: "Install…",
    start: "Start",
    fix: "Fix…",
    checkAgain: "Check again",
    quit: "Quit Monolith",
  },
  details: {
    show: "Show details",
    hide: "Hide details",
    copyLog: "Copy log",
    empty: "Nothing logged yet",
  },
  copy: "Copy",
  copied: "Copied",
} as const;
