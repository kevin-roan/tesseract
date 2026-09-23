const items = new Map<string, string>();

export const WHEN_UNLOCKED = 0;
export const AFTER_FIRST_UNLOCK = 1;
export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 5;

export type SecureStoreOptions = Record<string, unknown>;

export const getItemAsync = jest.fn(async (key: string) => items.get(key) ?? null);
export const setItemAsync = jest.fn(async (key: string, value: string) => {
  items.set(key, value);
});
export const deleteItemAsync = jest.fn(async (key: string) => {
  items.delete(key);
});
export const isAvailableAsync = jest.fn(async () => true);

export function __reset(): void {
  items.clear();
  getItemAsync.mockClear();
  setItemAsync.mockClear();
  deleteItemAsync.mockClear();
}

export function __dump(): Record<string, string> {
  return Object.fromEntries(items);
}
