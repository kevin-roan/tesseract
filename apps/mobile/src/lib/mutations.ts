type Resettable = { isPending: boolean; reset: () => void };

export function resetSettled(mutations: readonly Resettable[]): void {
  for (const mutation of mutations) if (!mutation.isPending) mutation.reset();
}
