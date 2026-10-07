import { DEEP_LINK_SCHEME, decodeSnapshotArg, type SnapshotRequest } from "../../shared/runtime";
import { isPageId, type PageId } from "../../shared/routes";
import { LOCAL_COMMAND_FLAGS, LOCAL_MODIFIER_FLAGS } from "../constants";

export interface LaunchArgs {
  hidden: boolean;
  quit: boolean;
  debug: boolean;
  page: PageId | null;
  deepLink: string | null;
  snapshot: SnapshotRequest | null;
  localCommand: string[] | null;
}

function valueOf(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index !== -1) return argv[index + 1] ?? null;
  const inline = argv.find((arg) => arg.startsWith(`${name}=`));
  return inline ? inline.slice(name.length + 1) : null;
}

function flagName(arg: string): string | null {
  return arg.startsWith("--") ? (arg.slice(2).split("=", 1)[0] ?? null) : null;
}

export function localCommandArgs(argv: readonly string[]): string[] | null {
  const names = argv.map(flagName);
  const command = (LOCAL_COMMAND_FLAGS as readonly (string | null)[]).some((flag) => names.includes(flag));
  if (!command) return null;
  const known: readonly string[] = [...LOCAL_COMMAND_FLAGS, ...LOCAL_MODIFIER_FLAGS];
  return argv.filter((_arg, index) => {
    const name = names[index];
    return name !== null && name !== undefined && known.includes(name);
  });
}

function pageArg(argv: readonly string[]): PageId | null {
  const value = valueOf(argv, "--page");
  if (value && isPageId(value)) return value;
  if (!argv.includes("--page")) return null;
  const positional = argv.slice(1).filter((arg) => !arg.startsWith("-"));
  return positional.reverse().find(isPageId) ?? null;
}

export function parseLaunchArgs(argv: readonly string[]): LaunchArgs {
  return {
    hidden: argv.includes("--hidden"),
    quit: argv.includes("--quit"),
    debug: argv.includes("--debug"),
    page: pageArg(argv),
    deepLink: argv.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null,
    snapshot: decodeSnapshotArg(argv),
    localCommand: localCommandArgs(argv),
  };
}
