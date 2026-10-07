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
