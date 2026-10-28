import { readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { CLAUDE_BUILTIN_COMMANDS, CLAUDE_COMMAND_NAME_PATTERN, LIMITS, type ClaudeCommand } from "@tesseract/protocol";
import { readRegularFile } from "../core/files";
import { isInside, realpathOrNull } from "../core/paths";
import type { ClaudeAccountService } from "./claude-accounts";
import type { ProjectService } from "./projects";

/** Where the sandbox image installs Claude Code's managed skills (`infra/docker/sandbox/rootfs/etc/claude-code`). */
export const MANAGED_SKILLS_DIR = "/etc/claude-code/.claude/skills";

export type ClaudeCommandOptions = {
  managedSkillsDir?: string;
  cacheMs?: number;
};

type Source = ClaudeCommand["source"];
type Frontmatter = Record<string, string>;

const CACHE_MS = 10_000;
const MAX_FILE_BYTES = 64 * 1024;
const MAX_PER_SOURCE = 200;
const MAX_ENTRIES_PER_DIR = 500;
const MAX_COMMAND_DEPTH = 4;

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && (trimmed[0] === '"' || trimmed[0] === "'") && trimmed.at(-1) === trimmed[0]) return trimmed.slice(1, -1);
  return trimmed;
};

/** The flat `key: value` pairs of a leading `---` block, with `>`/`|` block scalars folded to one line. */
export function parseFrontmatter(content: string): { data: Frontmatter; body: string } {
  const lines = content.replace(/^﻿/, "").split(/\r?\n/);
  if (lines[0]?.trim() !== "---") return { data: {}, body: lines.join("\n") };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) return { data: {}, body: lines.join("\n") };
  const data: Frontmatter = {};
  for (let index = 1; index < end; index += 1) {
    const match = /^([A-Za-z0-9_-]+):(.*)$/.exec(lines[index]!);
    if (!match) continue;
    const key = match[1]!;
    let value = match[2]!.trim();
    if (/^[>|][+-]?$/.test(value)) {
      const block: string[] = [];
      while (index + 1 < end && (/^\s/.test(lines[index + 1]!) || lines[index + 1]!.trim() === "")) block.push(lines[++index]!.trim());
      value = block.filter(Boolean).join(" ");
    }
    data[key] = unquote(value);
  }
  return { data, body: lines.slice(end + 1).join("\n") };
}

const describe = (data: Frontmatter, body: string): string => {
  const line = data.description?.trim() || body.split("\n").map((entry) => entry.replace(/^#+\s*/, "").trim()).find(Boolean) || "";
  return line.replace(/\s+/g, " ").slice(0, LIMITS.maxStatusMessageLength);
};

const validName = (name: string): boolean => name.length <= LIMITS.maxNameLength && CLAUDE_COMMAND_NAME_PATTERN.test(name);

/** Skills and custom slash commands Claude Code accepts in the sandbox, for the composers' `/` hints. */
export class ClaudeCommandService {
  private readonly cache = new Map<string, { at: number; commands: ClaudeCommand[] }>();
  private readonly managedSkillsDir: string;
  private readonly cacheMs: number;

  constructor(
    private readonly projects: Pick<ProjectService, "require">,
    private readonly accounts: Pick<ClaudeAccountService, "find" | "selectedId">,
    options: ClaudeCommandOptions = {},
  ) {
    this.managedSkillsDir = options.managedSkillsDir ?? MANAGED_SKILLS_DIR;
    this.cacheMs = options.cacheMs ?? CACHE_MS;
  }

  /** Deduplicated by name (project > user > managed > builtin), sorted by name. Throws 404 for an unknown project. */
  list(projectId?: string): ClaudeCommand[] {
    const project = projectId === undefined ? null : this.projects.require(projectId);
    const account = this.accounts.find(this.accounts.selectedId(project?.id ?? null));
    const key = `${project?.id ?? ""}\0${account?.configDir ?? ""}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < this.cacheMs) return cached.commands;

    const byName = new Map<string, ClaudeCommand>();
    const add = (commands: ClaudeCommand[]) => {
      for (const command of commands) byName.set(command.name, command);
    };
    add(CLAUDE_BUILTIN_COMMANDS.map(({ name, description }) => ({ name, description, kind: "command", source: "builtin" })));
    add(this.skills(this.managedSkillsDir, this.managedSkillsDir, "managed"));
    for (const [root, dir, source] of [
      [account?.configDir ?? null, account?.configDir ?? null, "user"],
      [project?.path ?? null, project ? join(project.path, ".claude") : null, "project"],
    ] as const) {
      if (root === null || dir === null) continue;
      add(this.commands(root, join(dir, "commands"), source));
      add(this.skills(root, join(dir, "skills"), source));
    }
    const commands = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    this.cache.set(key, { at: Date.now(), commands });
    return commands;
  }

  private skills(root: string, dir: string, source: Source): ClaudeCommand[] {
    const found: ClaudeCommand[] = [];
    for (const entry of this.entries(root, dir)) {
      if (found.length >= MAX_PER_SOURCE) break;
      if (!entry.directory) continue;
      const file = this.read(root, join(entry.path, "SKILL.md"));
      if (file === null) continue;
      const { data, body } = parseFrontmatter(file);
      if (data["user-invocable"]?.toLowerCase() === "false") continue;
      const name = data.name || entry.name;
      if (validName(name)) found.push({ name, description: describe(data, body), kind: "skill", source });
    }
    return found;
  }

  private commands(root: string, dir: string, source: Source, prefix: string[] = [], found: ClaudeCommand[] = []): ClaudeCommand[] {
    if (prefix.length >= MAX_COMMAND_DEPTH) return found;
    for (const entry of this.entries(root, dir)) {
      if (found.length >= MAX_PER_SOURCE) break;
      if (entry.directory) {
        this.commands(root, entry.path, source, [...prefix, entry.name], found);
        continue;
      }
      if (!entry.name.endsWith(".md")) continue;
      const name = [...prefix, basename(entry.name, ".md")].join(":");
      if (!validName(name)) continue;
      const file = this.read(root, entry.path);
      if (file === null) continue;
      const { data, body } = parseFrontmatter(file);
      found.push({ name, description: describe(data, body), kind: "command", source });
    }
    return found;
  }

  /** Entries of `dir` resolved to real paths inside `root`; anything a symlink takes elsewhere is dropped. */
  private entries(root: string, dir: string): { name: string; path: string; directory: boolean }[] {
    const realRoot = realpathOrNull(root);
    const realDir = realpathOrNull(dir);
    if (realRoot === null || realDir === null || !isInside(realRoot, realDir)) return [];
    let names: string[];
    try {
      names = readdirSync(realDir).sort().slice(0, MAX_ENTRIES_PER_DIR);
    } catch {
      return [];
    }
    const entries: { name: string; path: string; directory: boolean }[] = [];
    for (const name of names) {
      if (name.startsWith(".")) continue;
      const path = realpathOrNull(join(realDir, name));
      if (path === null || !isInside(realRoot, path)) continue;
      try {
        const stats = statSync(path);
        if (stats.isDirectory() || stats.isFile()) entries.push({ name, path, directory: stats.isDirectory() });
      } catch {
        continue;
      }
    }
    return entries;
  }

  private read(root: string, path: string): string | null {
    const realRoot = realpathOrNull(root);
    const real = realpathOrNull(path);
    if (realRoot === null || real === null || !isInside(realRoot, real)) return null;
    return readRegularFile(real, { maxBytes: MAX_FILE_BYTES, truncate: true })?.content ?? null;
  }
}
