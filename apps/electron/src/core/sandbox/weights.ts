import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BuildWeights } from "./buildkit";
import { BUILD_WEIGHTS_FILE, DOCKERFILE, HEAVY_STEP, HEAVY_WEIGHT } from "./constants";

const INSTRUCTION = /^(FROM|RUN|COPY|ADD|ENV|ARG|WORKDIR|USER|LABEL|SHELL|HEALTHCHECK|EXPOSE|VOLUME|ENTRYPOINT|CMD|STOPSIGNAL|ONBUILD)\b/i;
const VERTEX_INSTRUCTION = /^(FROM|RUN|COPY|ADD|WORKDIR)\b/i;

export function weightsFromDockerfile(dockerfile: string): BuildWeights {
  const stages: BuildWeights = {};
  let current: number[] | null = null;
  for (const line of dockerfile.replace(/\\\r?\n/g, " ").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !INSTRUCTION.test(trimmed)) continue;
    const stage = /^FROM\s+\S+\s+AS\s+(\S+)/i.exec(trimmed)?.[1];
    if (stage) {
      current = [1];
      stages[stage] = current;
      continue;
    }
    if (!VERTEX_INSTRUCTION.test(trimmed)) continue;
    current?.push(/^RUN\b/i.test(trimmed) && HEAVY_STEP.test(trimmed) ? HEAVY_WEIGHT : 1);
  }
  return stages;
}

function isWeights(value: unknown): value is BuildWeights {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((entry) => Array.isArray(entry) && entry.every((weight) => typeof weight === "number"))
  );
}

export async function loadBuildWeights(contextDir: string): Promise<BuildWeights | null> {
  const bundled = await readFile(join(contextDir, BUILD_WEIGHTS_FILE), "utf8")
    .then((text): unknown => JSON.parse(text))
    .catch(() => null);
  if (isWeights(bundled)) return bundled;
  return readFile(join(contextDir, ...DOCKERFILE), "utf8")
    .then(weightsFromDockerfile)
    .catch(() => null);
}
