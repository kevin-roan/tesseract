export const TIMELINE_SAMPLES = {
  user: "Take a look at this image.\nThen write the plan down.",
  userTime: "7h ago",
  system: "Session started (model claude-opus-5-5, cwd /workspace/projects/tesseract-mobile)",
  tools: [
    { tool: "Read", summary: "/workspace/.tesseract/uploads/upload-1.png", result: "Read 1 image (412 KB)", status: "ok" },
    { tool: "Bash", summary: "bun run typecheck", result: "error TS2322: Type 'string' is not assignable to type 'number'.", status: "error" },
    { tool: "Grep", summary: "useFollowTail", result: null, status: "pending" },
  ],
  assistant: `I didn't change \`00-blueprint.md\`, which already has uncommitted edits of yours.

5. **Android on a Mac host:** this needs arm64 system images and Homebrew/Android Studio paths.
6. **Plan:** it starts with a ½–1 day spike on a Mac.

Nothing is committed.`,
  runSystem: "Run finished in 92.6 s, 6 turns, 327,230 tokens",
  outcomeMeta: "1m 36s · 327k tokens",
  failedError: "API Error: 529 Overloaded. This is a server-side issue, usually temporary — try again in a moment.",
  failedMeta: "1m 57s · 35k tokens",
} as const;
