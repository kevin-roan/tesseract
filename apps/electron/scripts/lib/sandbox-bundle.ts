const LF_ONLY = [/^infra\/docker\/sandbox\//, /\.sh$/, /^infra\/compose\//];

export function needsLf(file: string): boolean {
  return LF_ONLY.some((pattern) => pattern.test(file));
}

export function hasCrlf(content: Uint8Array): boolean {
  for (let index = 1; index < content.length; index += 1) {
    if (content[index] === 0x0a && content[index - 1] === 0x0d) return true;
  }
  return false;
}

/**
 * `git ls-files` arguments for the bundle: tracked files plus untracked, non-ignored ones, so a new
 * module that has not been `git add`ed yet still reaches the image (its importers already do).
 */
export const BUNDLE_LS_FILES_ARGS = ["ls-files", "-z", "--cached", "--others", "--exclude-standard"] as const;

/** Splits `git ls-files -z` output, drops duplicates (unmerged entries) and tracked files deleted from the working tree. */
export function listedBundleFiles(output: string, exists: (file: string) => boolean): string[] {
  return [...new Set(output.split("\0").filter(Boolean))].filter(exists);
}

export interface SandboxManifest {
  files: Record<string, string>;
}

export function manifestMismatches(manifest: SandboxManifest, hashOf: (file: string) => string | null): string[] {
  return Object.entries(manifest.files).flatMap(([file, expected]) => {
    const actual = hashOf(file);
    if (actual === null) return [`${file}: missing`];
    return actual === expected ? [] : [`${file}: sha256 differs`];
  });
}
