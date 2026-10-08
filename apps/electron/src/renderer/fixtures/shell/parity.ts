import { currentScenario } from "../scenario";

export const GTK_PARITY = "gtk-parity";
export const GTK_PARITY_NOW = Date.parse("2026-10-06T23:17:00.000Z");

export const PARITY_PARAMS = { variant: "parity", clock: "clock" } as const;

export const PARITY_VARIANTS = {
  loading: "loading",
  connecting: "connecting",
  terminalsLoading: "terminals-loading",
} as const;

function queryParam(name: string): string | null {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  const hash = globalThis.location?.hash ?? "";
  const query = hash.indexOf("?");
  if (query !== -1) new URLSearchParams(hash.slice(query + 1)).forEach((value, key) => params.set(key, value));
  return params.get(name);
}

const loaded = {
  scenario: currentScenario(),
  variants: (queryParam(PARITY_PARAMS.variant) ?? "").split(",").filter(Boolean),
  clock: Number(queryParam(PARITY_PARAMS.clock) ?? 0),
};

export function isGtkParity(): boolean {
  return loaded.scenario === GTK_PARITY;
}

export function parityVariant(): string | null {
  return isGtkParity() ? (loaded.variants[0] ?? null) : null;
}

export function isParityVariant(...names: string[]): boolean {
  return isGtkParity() && loaded.variants.some((variant) => names.includes(variant));
}

let installed = false;

export function installParityClock(): void {
  if (installed || !isGtkParity()) return;
  installed = true;
  const RealDate = Date;
  const realNow = RealDate.now.bind(RealDate);
  const offset = GTK_PARITY_NOW + (Number.isFinite(loaded.clock) ? loaded.clock : 0) * 1000 - realNow();
  const now = () => realNow() + offset;
  class ParityDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(now());
      else super(...(args as [string | number]));
    }

    static override now(): number {
      return now();
    }
  }
  globalThis.Date = ParityDate as DateConstructor;
}

export const PARITY_CONNECTION = {
  pairingUrl: "https://tesseract-sandbox.tail511d9d.ts.net",
  token: "tk_9c2f7a1e5b3d8f60a4c1e7b2d9f3Yesk",
} as const;

export const PARITY_PROJECT_IDS: Readonly<Record<string, string>> = {
  streaxfit: "nimble-lotus",
  tesseract: "tesseract-mobile",
  "hybrid-pos": "brave-hare",
  "sante-production": "sante-production",
};

export function parityProjectId(id: string | null): string | null {
  return id === null ? null : (PARITY_PROJECT_IDS[id] ?? id);
}

export function parityAgo(seconds: number): string {
  return new Date(GTK_PARITY_NOW - seconds * 1000).toISOString();
}

export function pending(): Promise<never> {
  return new Promise<never>(() => undefined);
}
