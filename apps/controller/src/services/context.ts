import { lstatSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { LIMITS, type AgentContext, type AgentContextFile } from "@theone/protocol";
import { readRegularFile } from "../core/files";

const MARKDOWN = /\.md$/i;

function markdownFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && MARKDOWN.test(entry.name))
      .map((entry) => join(dir, entry.name))
      .sort();
  } catch {
    return [];
  }
}

function projectDirs(root: string): string[] {
  try {
    return readdirSync(join(root, "projects"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, "projects", entry.name))
      .sort();
  } catch {
    return [];
  }
}

/** `.agent/*.md` and `.agent/projects/<id>/*.md`; symlinks are never followed and content is capped. */
export function readAgentContext(agentDir: string, cap: number = LIMITS.contextFileMaxBytes): AgentContext {
  const paths = [...markdownFiles(agentDir), ...projectDirs(agentDir).flatMap(markdownFiles)];
  const files: AgentContextFile[] = [];
  for (const path of paths) {
    let stats;
    try {
      stats = lstatSync(path);
    } catch {
      continue;
    }
    if (!stats.isFile()) continue;
    const file = readRegularFile(path, { maxBytes: cap, truncate: true });
    if (!file) continue;
    files.push({
      name: relative(agentDir, path),
      path,
      sizeBytes: file.sizeBytes,
      modifiedAt: stats.mtime.toISOString(),
      truncated: file.truncated,
      content: file.content,
    });
  }
  return { files };
}
