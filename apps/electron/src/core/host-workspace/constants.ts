export const HOST_WORKSPACE = {
  workspaceArgs: ["host", "workspace"],
  serveArgs: ["serve"],
  healthPath: "/v1/health",
  accountsPath: "/v1/claude/accounts",
  accountsEnv: "TESSERACT_CLAUDE_ACCOUNTS",
  logFile: ["logs", "host-workspace.log"],
  cliTimeoutMs: 30_000,
  healthTimeoutMs: 1_500,
  startTimeoutMs: 20_000,
  pollMs: 400,
} as const;
