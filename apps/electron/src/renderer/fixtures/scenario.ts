export const SCENARIO_PARAM = "scenario";

export function currentScenario(): string | null {
  const params = new URLSearchParams(globalThis.location?.search ?? "");
  const hash = globalThis.location?.hash ?? "";
  const query = hash.indexOf("?");
  if (query !== -1) new URLSearchParams(hash.slice(query + 1)).forEach((value, key) => params.set(key, value));
  return params.get(SCENARIO_PARAM);
}

export function isScenario(name: string): boolean {
  return currentScenario() === name;
}
