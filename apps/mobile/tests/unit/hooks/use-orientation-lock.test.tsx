import { act, renderHook } from "@testing-library/react-native";
import * as ScreenOrientation from "expo-screen-orientation";

import { usePortraitLock, useRotationToggle } from "@/hooks/use-orientation-lock";

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(async () => undefined),
  OrientationLock: { PORTRAIT_UP: 3, LANDSCAPE: 5 },
}));

const lockAsync = ScreenOrientation.lockAsync as jest.Mock;
const { PORTRAIT_UP } = ScreenOrientation.OrientationLock;

const mockSetOptions = jest.fn();
jest.mock("expo-router", () => ({ useNavigation: () => ({ setOptions: mockSetOptions }) }));

beforeEach(() => {
  lockAsync.mockClear();
  mockSetOptions.mockClear();
});

describe("usePortraitLock", () => {
  it("locks the app upright", async () => {
    await renderHook(() => usePortraitLock());
    expect(lockAsync).toHaveBeenCalledWith(PORTRAIT_UP);
  });
});

describe("useRotationToggle", () => {
  it("flips the screen's native stack orientation without locking the app", async () => {
    const { result } = await renderHook(() => useRotationToggle());
    expect(result.current.supported).toBe(true);
    expect(result.current.landscape).toBe(false);
    expect(mockSetOptions).toHaveBeenLastCalledWith({ orientation: "portrait_up" });

    await act(async () => result.current.toggle());
    expect(result.current.landscape).toBe(true);
    expect(mockSetOptions).toHaveBeenLastCalledWith({ orientation: "landscape" });

    await act(async () => result.current.toggle());
    expect(mockSetOptions).toHaveBeenLastCalledWith({ orientation: "portrait_up" });
    expect(lockAsync).not.toHaveBeenCalled();
  });
});
