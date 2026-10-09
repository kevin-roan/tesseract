import { act, renderHook } from "@testing-library/react-native";

import { useIslandStore } from "@/features/island/store/island-store";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { useSandboxSwitch } from "@/hooks/use-sandbox-switch";

import { TEST_SANDBOX, TEST_TOKEN, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";

const mockRouter = { dismissAll: jest.fn(), canDismiss: jest.fn(() => true), push: jest.fn() };

jest.mock("expo-router", () => ({
  get router() {
    return mockRouter;
  },
}));

const OTHER = { ...TEST_SANDBOX, id: "sbx_other", name: "Other box", baseUrl: "http://127.0.0.2:7700" };

const seedTwo = () => {
  seedActiveSandbox();
  useSandboxStore.setState((state) => ({
    sandboxes: [...state.sandboxes, OTHER],
    tokens: { ...state.tokens, [OTHER.id]: TEST_TOKEN },
  }));
};

beforeEach(() => {
  resetSandboxState();
  useIslandStore.getState().reset();
  Object.values(mockRouter).forEach((fn) => fn.mockClear());
  mockRouter.canDismiss.mockReturnValue(true);
});

describe("useSandboxSwitch", () => {
  it("closes stacked screens and folds the island when the active sandbox changes", async () => {
    seedTwo();
    useIslandStore.setState({ expanded: true, focusedId: "run_1" });
    const { unmount } = await renderHook(() => useSandboxSwitch());

    await act(async () => useSandboxStore.getState().setActive(OTHER.id));

    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
    expect(useIslandStore.getState()).toMatchObject({ expanded: false, focusedId: null });

    await unmount();
    await act(async () => useSandboxStore.getState().setActive(TEST_SANDBOX.id));
    expect(mockRouter.dismissAll).toHaveBeenCalledTimes(1);
  });

  it("dismisses before navigation queued right after the switch", async () => {
    seedTwo();
    await renderHook(() => useSandboxSwitch());

    await act(async () => {
      useSandboxStore.getState().setActive(OTHER.id);
      mockRouter.push("/inbox");
    });

    expect(mockRouter.dismissAll.mock.invocationCallOrder[0]).toBeLessThan(mockRouter.push.mock.invocationCallOrder[0]);
  });

  it("ignores hydration, re-selecting the same sandbox, first pairing and an empty stack", async () => {
    await renderHook(() => useSandboxSwitch());

    await act(async () => useSandboxStore.setState({ sandboxes: [TEST_SANDBOX], activeId: TEST_SANDBOX.id, hydrated: true }));
    await act(async () => useSandboxStore.getState().setActive(TEST_SANDBOX.id));
    expect(mockRouter.dismissAll).not.toHaveBeenCalled();

    await act(async () => useSandboxStore.setState({ sandboxes: [TEST_SANDBOX, OTHER] }));
    mockRouter.canDismiss.mockReturnValue(false);
    await act(async () => useSandboxStore.getState().setActive(OTHER.id));
    expect(mockRouter.dismissAll).not.toHaveBeenCalled();
  });
});
