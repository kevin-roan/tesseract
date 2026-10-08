import type { InboxKind } from "@tesseract/protocol";
import {
  ChatCircleDotsIcon,
  CheckCircleIcon,
  FileArrowDownIcon,
  InfoIcon,
  ShieldWarningIcon,
  XCircleIcon,
  type Icon,
} from "phosphor-react-native";

import type { Tone } from "@/lib/tone";

export type InboxKindMeta = { icon: Icon; tone: Tone; label: string };

const KIND_META: Record<InboxKind, InboxKindMeta> = {
  needs_input: { icon: ChatCircleDotsIcon, tone: "warning", label: "Waiting for your reply" },
  permission: { icon: ShieldWarningIcon, tone: "warning", label: "Asking for permission" },
  completed: { icon: CheckCircleIcon, tone: "success", label: "Finished" },
  failed: { icon: XCircleIcon, tone: "danger", label: "Failed" },
  status: { icon: InfoIcon, tone: "info", label: "Update" },
  file: { icon: FileArrowDownIcon, tone: "info", label: "Shared a file" },
};

export const inboxKindMeta = (kind: InboxKind): InboxKindMeta => KIND_META[kind];
