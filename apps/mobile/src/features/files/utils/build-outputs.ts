import type { BuildOutput } from "@theone/protocol";
import { AndroidLogoIcon, AppleLogoIcon, FileZipIcon, LinuxLogoIcon, WindowsLogoIcon, type Icon } from "phosphor-react-native";

import { capitalize, formatBytes, formatRelativeTime, pluralize } from "@/features/sandbox/utils/format";

const PLATFORM_ICONS: Record<string, Icon> = {
  android: AndroidLogoIcon,
  windows: WindowsLogoIcon,
  linux: LinuxLogoIcon,
  macos: AppleLogoIcon,
  ios: AppleLogoIcon,
};

const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(" · ");

export const buildOutputKey = (output: Pick<BuildOutput, "projectId" | "path">): string => `${output.projectId}/${output.path}`;

export const buildOutputIcon = (platform: string): Icon => PLATFORM_ICONS[platform] ?? FileZipIcon;

export const filterBuildOutputs = (outputs: readonly BuildOutput[], projectId: string | null): BuildOutput[] =>
  projectId ? outputs.filter((output) => output.projectId === projectId) : [...outputs];

export function buildOutputSubtitle(output: BuildOutput, project: string | null): string {
  return join([project ?? output.projectId, formatBytes(output.sizeBytes)]);
}

export function buildOutputMeta(output: BuildOutput, now: number = Date.now()): string {
  const platform = output.platform === "file" ? null : capitalize(output.platform);
  return join([platform, formatRelativeTime(output.modifiedAt, now)]);
}

export const buildOutputFolder = (output: BuildOutput): string =>
  output.path.slice(0, Math.max(0, output.path.length - output.fileName.length - 1)) || ".";

export function buildOutputsSubtitle(shown: number, total: number): string | undefined {
  if (total === 0) return undefined;
  return shown === total ? pluralize(total, "build") : `${shown} of ${pluralize(total, "build")}`;
}
