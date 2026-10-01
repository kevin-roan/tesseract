import type { Artifact, ArtifactSource, TaildropTarget } from "@theone/protocol";
import { FileArrowDownIcon, HammerIcon, PackageIcon, RobotIcon, type Icon } from "phosphor-react-native";

import type { StatusBadgeProps } from "@/components/status-badge";
import { capitalize, formatBytes, formatRelativeTime, pluralize } from "@/features/sandbox/utils/format";

const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

const SOURCE_BADGES: Record<ArtifactSource, StatusBadgeProps> = {
  agent: { label: "Shared", tone: "info", icon: RobotIcon },
  build: { label: "Build", tone: "neutral", icon: HammerIcon },
};

const SOURCE_ICONS: Record<ArtifactSource, Icon> = {
  agent: FileArrowDownIcon,
  build: PackageIcon,
};

export const fileIcon = (source: ArtifactSource): Icon => SOURCE_ICONS[source];

export const fileSourceBadge = (source: ArtifactSource): StatusBadgeProps => SOURCE_BADGES[source];

export function fileSubtitle(artifact: Artifact, project: string | null): string {
  return join([project ?? artifact.projectId, formatBytes(artifact.sizeBytes)]);
}

export function fileMeta(artifact: Artifact, now: number = Date.now()): string {
  return join([artifact.platform ? capitalize(artifact.platform) : null, formatRelativeTime(artifact.createdAt, now)]);
}

export function filesSubtitle(shown: number, total: number): string | undefined {
  if (total === 0) return undefined;
  return shown === total ? pluralize(total, "file") : `${shown} of ${pluralize(total, "file")}`;
}

const osLabel = (os: string | null): string | null => (os && os === os.toLowerCase() ? capitalize(os) : os);

export function taildropTargetSubtitle(target: TaildropTarget): string {
  return join([osLabel(target.os), target.online ? "Online" : "Offline"]);
}

export function sortTaildropTargets(targets: readonly TaildropTarget[]): TaildropTarget[] {
  return [...targets].sort(
    (a, b) => Number(b.online) - Number(a.online) || a.hostName.localeCompare(b.hostName),
  );
}
