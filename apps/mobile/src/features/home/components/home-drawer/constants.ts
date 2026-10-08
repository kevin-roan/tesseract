import {
  ChartBarIcon,
  ChatsCircleIcon,
  CheckSquareIcon,
  FolderIcon,
  FoldersIcon,
  SparkleIcon,
  TrayIcon,
  type Icon,
} from "phosphor-react-native";

export const DRAWER_TITLE = "Tesseract";
export const DRAWER_RECENTS_TITLE = "Recents";
export const DRAWER_ALL_CHATS_LABEL = "All chats";
export const DRAWER_SETTINGS_LABEL = "Open settings";
export const DRAWER_PROFILE_LABEL = "Open profile";
export const DRAWER_RECENTS_LIMIT = 8;

export const DRAWER_ROUTES = {
  chats: "/chats",
  projects: "/projects",
  agents: "/agents",
  tasks: "/tasks",
  analytics: "/analytics",
  profile: "/profile",
} as const;

export type DrawerNavId = "chats" | "projects" | "agents" | "tasks" | "analytics" | "files" | "inbox";

export type DrawerNavItem = { id: DrawerNavId; label: string; icon: Icon };

export const DRAWER_NAV: readonly DrawerNavItem[] = [
  { id: "chats", label: "Chats", icon: ChatsCircleIcon },
  { id: "projects", label: "Projects", icon: FoldersIcon },
  { id: "agents", label: "Agents", icon: SparkleIcon },
  { id: "tasks", label: "Tasks", icon: CheckSquareIcon },
  { id: "analytics", label: "Analytics", icon: ChartBarIcon },
  { id: "files", label: "Files", icon: FolderIcon },
  { id: "inbox", label: "Inbox", icon: TrayIcon },
];
