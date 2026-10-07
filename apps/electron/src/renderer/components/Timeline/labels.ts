export const TIMELINE_LABELS = {
  jump: "Jump to latest",
  you: "You",
  claude: "Claude",
  thinking: "Claude is thinking…",
  copy: "Copy",
  copied: "Copied to clipboard",
  tool: { input: "Input", output: "Result" },
  outcome: {
    succeeded: "Finished",
    failed: "Run failed",
    cancelled: "Run cancelled",
  },
} as const;

export type ToolCardLabels = { input: string; output: string };
