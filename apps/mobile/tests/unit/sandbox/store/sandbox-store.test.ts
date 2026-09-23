import { useSandboxStore, selectActiveSandbox, selectActiveToken } from "@/features/sandbox/store/sandbox-store";
import type { PairedSandbox } from "@/features/sandbox/types";
import { SANDBOX_STORE_NAME } from "@/features/sandbox/utils/constants";
import { tokenStorageKey } from "@/features/sandbox/utils/identity";

import { __dump as dumpSecure, deleteItemAsync, setItemAsync } from "../../../mocks/expo-secure-store";
import { __dump as dumpKv, __seed as seedKv } from "../../../mocks/expo-sqlite-kv-store";
import { resetSandboxState } from "../helpers";

const LAPTOP: PairedSandbox = { id: "sbx_laptop", name: "Laptop", baseUrl: "http://127.0.0.1:7700", addedAt: "2026-09-20T10:00:00.000Z" };
const TAILNET: PairedSandbox = {
  id: "sbx_tailnet",
  name: "Tailnet",
  baseUrl: "https://theone-sandbox.tail1234.ts.net",
  addedAt: "2026-09-21T10:00:00.000Z",
};

const store = () => useSandboxStore.getState();
const persisted = () => JSON.parse(dumpKv()[SANDBOX_STORE_NAME] ?? "null") as { state: Record<string, unknown>; version: number } | null;

beforeEach(resetSandboxState);

describe("hydrate", () => {
  it("restores the list from storage and the tokens from the secure store", async () => {
    seedKv(SANDBOX_STORE_NAME, JSON.stringify({ state: { sandboxes: [LAPTOP, TAILNET], activeId: TAILNET.id }, version: 1 }));
    await setItemAsync(tokenStorageKey(LAPTOP.id), "laptop-token");
    await setItemAsync(tokenStorageKey(TAILNET.id), "tailnet-token");

    await store().hydrate();

    expect(store().hydrated).toBe(true);
    expect(store().sandboxes).toEqual([LAPTOP, TAILNET]);
    expect(selectActiveSandbox(store())).toEqual(TAILNET);
    expect(selectActiveToken(store())).toBe("tailnet-token");
  });

  it("falls back to the first sandbox and tolerates a missing token", async () => {
    seedKv(SANDBOX_STORE_NAME, JSON.stringify({ state: { sandboxes: [LAPTOP], activeId: "sbx_gone" }, version: 1 }));

    await store().hydrate();

    expect(store().activeId).toBe(LAPTOP.id);
    expect(store().tokens).toEqual({});
    expect(selectActiveToken(store())).toBeNull();
  });

  it("finishes with an empty store on first launch and only hydrates once", async () => {
    await Promise.all([store().hydrate(), store().hydrate()]);
    expect(store()).toMatchObject({ hydrated: true, sandboxes: [], activeId: null });
  });
});

describe("addSandbox", () => {
  beforeEach(() => useSandboxStore.setState({ hydrated: true }));

  it("keeps the token in the secure store and out of the persisted blob", async () => {
    const sandbox = await store().addSandbox({ name: "Laptop", baseUrl: LAPTOP.baseUrl, token: "super-secret-token" });

    expect(sandbox.id).toMatch(/^sbx_/);
    expect(dumpSecure()).toEqual({ [tokenStorageKey(sandbox.id)]: "super-secret-token" });
    expect(store().activeId).toBe(sandbox.id);
    expect(store().tokens[sandbox.id]).toBe("super-secret-token");

    const blob = dumpKv()[SANDBOX_STORE_NAME];
    expect(blob).toBeDefined();
    expect(blob).not.toContain("super-secret-token");
    expect(persisted()?.state).toEqual({ sandboxes: [sandbox], activeId: sandbox.id });
  });

  it("re-pairing the same URL keeps the id and replaces name and token", async () => {
    const first = await store().addSandbox({ name: "Old", baseUrl: LAPTOP.baseUrl, token: "token-one" });
    const second = await store().addSandbox({ name: "New", baseUrl: LAPTOP.baseUrl, token: "token-two" });

    expect(second.id).toBe(first.id);
    expect(store().sandboxes).toEqual([{ ...first, name: "New" }]);
    expect(dumpSecure()[tokenStorageKey(first.id)]).toBe("token-two");
  });

  it("hydrates first so pairing before the list loads keeps the stored sandboxes", async () => {
    useSandboxStore.setState({ hydrated: false });
    seedKv(SANDBOX_STORE_NAME, JSON.stringify({ state: { sandboxes: [LAPTOP], activeId: LAPTOP.id }, version: 1 }));

    const added = await store().addSandbox({ name: "Tailnet", baseUrl: TAILNET.baseUrl, token: "tailnet-token" });

    expect(store().sandboxes).toEqual([LAPTOP, added]);
    expect(persisted()?.state).toEqual({ sandboxes: [LAPTOP, added], activeId: added.id });
  });

  it("does not save the sandbox when the secure store refuses the token", async () => {
    setItemAsync.mockRejectedValueOnce(new Error("keychain locked"));

    await expect(store().addSandbox({ name: "Box", baseUrl: TAILNET.baseUrl, token: "tok" })).rejects.toThrow("keychain locked");
    expect(store().sandboxes).toEqual([]);
  });
});

describe("switch, rename and remove", () => {
  beforeEach(async () => {
    useSandboxStore.setState({ hydrated: true });
    await store().addSandbox({ name: "Laptop", baseUrl: LAPTOP.baseUrl, token: "laptop-token" });
    await store().addSandbox({ name: "Tailnet", baseUrl: TAILNET.baseUrl, token: "tailnet-token" });
  });

  it("switches only to known sandboxes and persists the choice", () => {
    const [laptop] = store().sandboxes;
    store().setActive(laptop.id);
    expect(store().activeId).toBe(laptop.id);
    expect(persisted()?.state.activeId).toBe(laptop.id);

    store().setActive("sbx_unknown");
    expect(store().activeId).toBe(laptop.id);
  });

  it("renames with trimming and ignores blank names", () => {
    const [laptop] = store().sandboxes;
    store().renameSandbox(laptop.id, "  Desk  ");
    store().renameSandbox(laptop.id, "   ");
    expect(store().sandboxes[0].name).toBe("Desk");
  });

  it("removes a sandbox, deletes its token and activates the next one", async () => {
    const [laptop, tailnet] = store().sandboxes;
    store().setActive(tailnet.id);

    await store().removeSandbox(tailnet.id);

    expect(deleteItemAsync).toHaveBeenCalledWith(tokenStorageKey(tailnet.id), expect.anything());
    expect(store().sandboxes).toEqual([laptop]);
    expect(store().activeId).toBe(laptop.id);
    expect(store().tokens).toEqual({ [laptop.id]: "laptop-token" });
    expect(Object.keys(dumpSecure())).toEqual([tokenStorageKey(laptop.id)]);
  });

  it("clears the active id when the last sandbox is removed", async () => {
    for (const sandbox of store().sandboxes) await store().removeSandbox(sandbox.id);
    expect(store().activeId).toBeNull();
    expect(persisted()?.state).toEqual({ sandboxes: [], activeId: null });
  });
});
