import { DOWNLOAD_URLS } from "../onboarding/urls";
import type { CommandResult } from "../process";
import {
  ARCH_DISTROS,
  ARCH_PACKAGES,
  CONVENIENCE_SCRIPT_DISTROS,
  DOCKER_GROUP,
  DOCKER_SERVICE,
  GET_DOCKER_SCRIPT,
  OSASCRIPT_CANCELLED,
  PKEXEC_DISMISSED,
  PKEXEC_NO_AGENT,
  SUSE_DISTROS,
  SUSE_PACKAGES,
  WINDOWS_REBOOT_REQUIRED,
  WINDOWS_UAC_CANCELLED,
} from "./constants";
import type { OsRelease } from "./parse";

export type LinuxFamily = "convenience" | "arch" | "suse" | "manual";
export type ElevationOutcome = "ok" | "cancelled" | "no-agent" | "reboot" | "failed";

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function appleScriptString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function powershellQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function linuxFamily(distro: OsRelease): LinuxFamily {
  const ids = [distro.id, ...distro.idLike];
  const matches = (list: readonly string[]) => ids.some((id) => list.includes(id));
  if (matches(CONVENIENCE_SCRIPT_DISTROS)) return "convenience";
  if (matches(ARCH_DISTROS)) return "arch";
  if (matches(SUSE_DISTROS) || ids.some((id) => id.startsWith("opensuse"))) return "suse";
  return "manual";
}

export function enableAndGroupCommands(user: string): string[] {
  return [`systemctl enable --now ${DOCKER_SERVICE}`, `usermod -aG ${DOCKER_GROUP} ${shellQuote(user)}`];
}

export function linuxInstallSteps(family: LinuxFamily, user: string, scriptPath: string): string[] {
  const tail = enableAndGroupCommands(user);
  switch (family) {
    case "convenience":
      return [`sh ${shellQuote(scriptPath)}`, ...tail];
    case "arch":
      return [`pacman -S --needed --noconfirm ${ARCH_PACKAGES.join(" ")}`, ...tail];
    case "suse":
      return [`zypper --non-interactive install ${SUSE_PACKAGES.join(" ")}`, ...tail];
    default:
      return [];
  }
}

export function manualLinuxCommands(family: LinuxFamily, user: string): string[] {
  const steps =
    family === "manual" || family === "convenience"
      ? [`curl -fsSL ${DOWNLOAD_URLS.dockerGetScript} -o ${GET_DOCKER_SCRIPT}`, `sh ${GET_DOCKER_SCRIPT}`, ...enableAndGroupCommands(user)]
      : linuxInstallSteps(family, user, "");
  return steps.map((step) => (step.startsWith("curl") ? step : `sudo ${step}`));
}

export function manualGroupCommand(group: string): string {
  return `sudo usermod -aG ${group} $USER`;
}

export function groupCommand(group: string, user: string): string {
  return `getent group ${group} >/dev/null || groupadd ${group}; usermod -aG ${group} ${shellQuote(user)}`;
}

export function macInstallScript(dmg: string, mountPoint: string, user: string): string {
  const mount = shellQuote(mountPoint);
  const installer = shellQuote(`${mountPoint}/Docker.app/Contents/MacOS/install`);
  return [
    `hdiutil attach -nobrowse -quiet -mountpoint ${mount} ${shellQuote(dmg)} && ${installer} --accept-license --user=${shellQuote(user)}`,
    "s=$?",
    `hdiutil detach -quiet ${mount}`,
    "exit $s",
  ].join("; ");
}

export function osascriptAdminArgs(script: string): string[] {
  return ["-e", `do shell script ${appleScriptString(script)} with administrator privileges`];
}

export function powershellElevated(file: string, args: readonly string[]): string[] {
  const argumentList = args.map(powershellQuote).join(",");
  const command = `$p = Start-Process -Verb RunAs -Wait -PassThru -FilePath ${powershellQuote(file)}${
    args.length ? ` -ArgumentList ${argumentList}` : ""
  }; exit $p.ExitCode`;
  return ["-NoProfile", "-NonInteractive", "-Command", command];
}

export function pkexecOutcome(result: CommandResult): ElevationOutcome {
  if (result.code === 0) return "ok";
  if (result.code === PKEXEC_DISMISSED) return "cancelled";
  if (result.code === PKEXEC_NO_AGENT || /no authentication agent/i.test(result.stderr)) return "no-agent";
  return "failed";
}

export function osascriptOutcome(result: CommandResult): ElevationOutcome {
  if (result.code === 0) return "ok";
  if (result.stderr.includes(`(${OSASCRIPT_CANCELLED})`) || /user canceled/i.test(result.stderr)) return "cancelled";
  return "failed";
}

export function windowsOutcome(result: CommandResult): ElevationOutcome {
  if (result.code === WINDOWS_UAC_CANCELLED || /canceled by the user|cancelled by the user/i.test(result.stderr)) return "cancelled";
  if (result.code === WINDOWS_REBOOT_REQUIRED || /\brestart\b/i.test(`${result.stdout}\n${result.stderr}`)) return "reboot";
  return result.code === 0 ? "ok" : "failed";
}
