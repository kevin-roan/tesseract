type Listener = (event: { contentTypes: string[] }) => void;

const listeners = new Set<Listener>();

export const hasImageAsync = jest.fn(async () => false);
export const getStringAsync = jest.fn(async () => "");
export const getImageAsync = jest.fn(async (): Promise<{ data: string; size: { width: number; height: number } } | null> => null);
export const addClipboardListener = jest.fn((listener: Listener) => {
  listeners.add(listener);
  return { remove: () => listeners.delete(listener) };
});

export function __emitChange(contentTypes: string[] = ["image"]): void {
  listeners.forEach((listener) => listener({ contentTypes }));
}

export function __reset(): void {
  listeners.clear();
  hasImageAsync.mockReset().mockResolvedValue(false);
  getImageAsync.mockReset().mockResolvedValue(null);
  getStringAsync.mockReset().mockResolvedValue("");
}
