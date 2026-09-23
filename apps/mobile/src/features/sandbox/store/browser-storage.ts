type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const memory = new Map<string, string>();

const memoryStorage: KeyValueStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

export function browserStorage(): KeyValueStorage {
  if (typeof window === "undefined") return memoryStorage;
  try {
    return window.localStorage ?? memoryStorage;
  } catch {
    return memoryStorage;
  }
}
