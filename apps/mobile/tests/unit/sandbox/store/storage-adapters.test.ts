import { browserStorage } from "@/features/sandbox/store/browser-storage";
import { listStorage } from "@/features/sandbox/store/list-storage";
import { listStorage as webListStorage } from "@/features/sandbox/store/list-storage.web";
import { tokenStorage as webTokenStorage } from "@/features/sandbox/store/token-storage.web";
import { tokenStorageKey } from "@/features/sandbox/utils/identity";

import { __dump as dumpKv, __reset as resetKv } from "../../../mocks/expo-sqlite-kv-store";

const globals = globalThis as unknown as { window?: unknown };
const original = globals.window;

function fakeLocalStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: jest.fn((key: string) => items.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => void items.set(key, value)),
    removeItem: jest.fn((key: string) => void items.delete(key)),
  };
}

afterEach(() => {
  globals.window = original;
  resetKv();
});

describe("browserStorage", () => {
  it("uses localStorage when the browser has one", () => {
    const local = fakeLocalStorage();
    globals.window = { localStorage: local };
    browserStorage().setItem("k", "v");
    expect(local.items.get("k")).toBe("v");
  });

  it("falls back to memory without a window, without localStorage, or when access throws", () => {
    globals.window = undefined;
    const memory = browserStorage();
    memory.setItem("k", "v");
    expect(memory.getItem("k")).toBe("v");

    globals.window = {};
    expect(browserStorage()).toBe(memory);

    globals.window = Object.defineProperty({}, "localStorage", {
      get() {
        throw new Error("SecurityError");
      },
    });
    expect(browserStorage()).toBe(memory);
    memory.removeItem("k");
    expect(memory.getItem("k")).toBeNull();
  });
});

describe("listStorage (native)", () => {
  it("round-trips through the SQLite key-value store", async () => {
    await listStorage.setItem("list", "[1]");
    expect(dumpKv()).toEqual({ list: "[1]" });
    await expect(listStorage.getItem("list")).resolves.toBe("[1]");
    await listStorage.removeItem("list");
    await expect(listStorage.getItem("list")).resolves.toBeNull();
  });
});

describe("web storage adapters", () => {
  it("keep the sandbox list in localStorage", () => {
    const local = fakeLocalStorage();
    globals.window = { localStorage: local };

    webListStorage.setItem("list", "[2]");
    expect(webListStorage.getItem("list")).toBe("[2]");
    webListStorage.removeItem("list");
    expect(local.items.size).toBe(0);
  });

  it("keep tokens under the namespaced key", async () => {
    const local = fakeLocalStorage();
    globals.window = { localStorage: local };

    await webTokenStorage.write("sbx_1", "secret");
    expect(local.items.get(tokenStorageKey("sbx_1"))).toBe("secret");
    await expect(webTokenStorage.read("sbx_1")).resolves.toBe("secret");
    await webTokenStorage.remove("sbx_1");
    await expect(webTokenStorage.read("sbx_1")).resolves.toBeNull();
  });
});
