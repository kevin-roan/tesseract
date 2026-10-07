import type { GitCommit, GitDetails } from "@theone/protocol";

const SUBJECTS = [
  "chore; eas updates",
  "fix; store related fixes",
  "fix; bugs",
  "fix: correct IMAGE_HOST to partner-api.mysante.com so catalogue images load",
  "feat; storefront checkout flow",
  "chore; bump expo sdk",
  "fix; cart totals rounding",
  "feat; order history screen",
  "refactor; split api client",
  "fix; android back handler",
  "feat; push notifications",
  "chore; lint",
  "fix; splash screen flicker",
  "feat; product search",
  "fix; login redirect",
  "chore; update icons",
  "feat; wishlist",
  "fix; currency formatting",
  "feat; onboarding carousel",
  "chore; initial storefront setup",
];

const DAYS = [21, 18, 17, 14, 12, 11, 9, 8, 6, 5, 4, 3, 2, 1];

const SHAS = ["fedd96b", "dc0b5af", "93401aa", "aad8be7", "71c2e04", "5b9f1d3", "c40e8a2", "e9d1772", "0a3f5c1", "b7e2d90"];

const commits: GitCommit[] = SUBJECTS.map((subject, index) => ({
  sha: `${SHAS[index % SHAS.length]}${String(index).padStart(2, "0")}0f3a9c1d2e4b`,
  subject,
  author: index === 3 ? "Kevin Bpract" : "Kevin Roan",
  date: new Date(Date.UTC(2026, 8, DAYS[index] ?? 1, 12)).toISOString(),
}));

export const FIXTURE_GIT: Readonly<Record<string, GitDetails>> = {
  "sante-production": {
    branch: "prod/storefront-fixes",
    ahead: 0,
    behind: 0,
    files: [
      { path: ".env", index: " ", worktree: "M" },
      { path: "app.json", index: " ", worktree: "M" },
      { path: "bun.lock", index: " ", worktree: "M" },
      { path: "package.json", index: " ", worktree: "M" },
      { path: "feature_deploy.md", index: "?", worktree: "?" },
    ],
    log: commits,
  },
  "hybrid-pos": {
    branch: "merge/multi-company-into-production",
    ahead: 2,
    behind: 1,
    files: [
      { path: "src/main/ipc/printers.ts", index: "A", worktree: "M" },
      { path: "src/legacy/report.ts", index: "D", worktree: " " },
      { path: "src/store/cart.ts", index: "U", worktree: "U" },
    ],
    log: commits.slice(0, 6),
  },
  monolith: { branch: "main", ahead: 0, behind: 0, files: [], log: commits.slice(0, 3) },
  streaxfit: { branch: null, ahead: 0, behind: 0, files: [], log: [] },
};

export const FIXTURE_GIT_FALLBACK: GitDetails = { branch: "main", ahead: 0, behind: 0, files: [], log: [] };
