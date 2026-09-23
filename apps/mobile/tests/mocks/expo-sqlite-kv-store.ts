const items = new Map<string, string>();

export const Storage = {
  getItem: jest.fn(async (key: string) => items.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    items.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    items.delete(key);
  }),
};

export default Storage;

export function __reset(): void {
  items.clear();
}

export function __dump(): Record<string, string> {
  return Object.fromEntries(items);
}

export function __seed(key: string, value: string): void {
  items.set(key, value);
}
