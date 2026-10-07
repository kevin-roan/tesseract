import type { ProjectCardModel } from "./model";

export const PROJECT_GALLERY_WIDTH = 680;

export const PROJECT_GALLERY_CARDS: readonly ProjectCardModel[] = [
  {
    id: "streaxfit",
    title: "streaxfit",
    subtitle: "Node · pnpm · nimble-lotus",
    confidential: { label: "Confidential", tone: "warning" },
    activity: { label: "1 running", tone: "success" },
    branch: "main",
    dirty: { label: "Uncommitted changes", tone: "warning" },
    commit: "feat: logins of staff who left are hidden from the picker",
    commitWhen: "5d ago",
    tags: ["Web bundle", "Build script"],
  },
  {
    id: "monolith",
    title: "monolith",
    subtitle: "Node · bun · theone-mobile",
    activity: { label: "Idle", tone: "neutral" },
    branch: "main",
    dirty: { label: "Uncommitted changes", tone: "warning" },
    commit: "feat; more features",
    commitWhen: "5h ago",
    tags: [],
  },
  {
    id: "hybrid-pos",
    title: "hybrid-pos",
    subtitle: "Electron · bun · brave-hare",
    activity: { label: "Idle", tone: "neutral" },
    branch: "merge/multi-company-into-production",
    dirty: { label: "Uncommitted changes", tone: "warning" },
    commit: "feat; sales return print",
    commitWhen: "1d ago",
    tags: ["Linux AppImage", "Windows installer", "Build script"],
  },
  {
    id: "sante-production",
    title: "sante-production",
    subtitle: "Expo · bun · sante-production",
    activity: { label: "Idle", tone: "neutral" },
    branch: "prod/storefront-fixes",
    dirty: { label: "Uncommitted changes", tone: "warning" },
    commit: "chore; eas updates",
    commitWhen: "2026-09-21",
    tags: ["Android APK"],
  },
];
