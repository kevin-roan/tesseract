import { ChecksIcon } from "phosphor-react-native";

export const INBOX_ACTIONS = {
  markAllRead: { id: "mark-all-read", icon: ChecksIcon, label: "Mark all read" },
} as const;
