import { act, renderHook, waitFor } from "@testing-library/react-native";
import { ApiError, HostShellClient } from "@tesseract/client";

import { useHostUnlock } from "@/features/host-shell/hooks/use-host-unlock";
import { useHostSessionStore } from "@/features/host-shell/store/host-session-store";
import { useHostStore } from "@/features/host-shell/store/host-store";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { createTestQueryClient, createWrapper } from "../sandbox/helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), HostShellClient: jest.fn() }));

const MockClient = HostShellClient as unknown as jest.Mock;
const fake = { lockStatus: jest.fn(), unlock: jest.fn(), sessionClient: jest.fn(() => ({})) };
const HOST = { name: "Desk", baseUrl: "http://100.64.0.1:7701", addedAt: "2026-10-03T10:00:00.000Z" };

beforeEach(() => {
  fake.lockStatus.mockReset().mockResolvedValue({ pinSet: true, attemptsLeft: 5, lockedUntil: null });
  fake.unlock.mockReset();
  MockClient.mockReset().mockImplementation(() => fake);
  useSandboxStore.setState({ activeId: "sbx_a", hydrated: true });
  useHostStore.setState({ hosts: { sbx_a: HOST }, tokens: { sbx_a: `token-${Math.random()}` }, hydrated: true });
  useHostSessionStore.getState().clear();
});

const render = () => renderHook(() => useHostUnlock(true), { wrapper: createWrapper(createTestQueryClient()) });

const enter = async (result: { current: ReturnType<typeof useHostUnlock> }, digits: string) => {
  for (const digit of digits) await act(async () => result.current.press({ kind: "digit", digit }));
};

describe("useHostUnlock", () => {
  it("only submits a complete PIN and starts the session", async () => {
    fake.unlock.mockResolvedValue({ session: "hss_1", expiresAt: new Date(Date.now() + 60_000).toISOString() });
    const { result } = await render();
    await waitFor(() => expect(fake.lockStatus).toHaveBeenCalled());

    await enter(result, "12345");
    expect(result.current.canSubmit).toBe(false);
    await act(async () => result.current.press({ kind: "submit" }));
    expect(fake.unlock).not.toHaveBeenCalled();

    await enter(result, "6");
    await act(async () => result.current.press({ kind: "submit" }));
    await waitFor(() => expect(useHostSessionStore.getState().current?.session).toBe("hss_1"));
    expect(fake.unlock).toHaveBeenCalledWith("123456");
    expect(result.current.pin.digits).toBe("");
    useHostSessionStore.getState().clear();
  });

  it("clears the pad and shows the host's message on a wrong PIN", async () => {
    fake.unlock.mockRejectedValue(new ApiError(403, "forbidden", "Wrong PIN (4 attempts left)"));
    const { result } = await render();
    await enter(result, "000000");
    await act(async () => result.current.press({ kind: "submit" }));

    await waitFor(() => expect(result.current.rejectedMessage).toBe("Wrong PIN (4 attempts left)"));
    expect(result.current.pin).toEqual({ digits: "", error: true });
    expect(result.current.message).toBeNull();
    expect(useHostSessionStore.getState().current).toBeNull();
  });

  it("disables the pad while locked out or when no PIN is set", async () => {
    fake.lockStatus.mockResolvedValue({ pinSet: true, attemptsLeft: 0, lockedUntil: new Date(Date.now() + 300_000).toISOString() });
    const { result } = await render();
    await waitFor(() => expect(result.current.disabled).toBe(true));
    expect(result.current.line?.tone).toBe("danger");

    await enter(result, "1");
    expect(result.current.pin.digits).toBe("");
  });

  it("reports a missing PIN", async () => {
    fake.lockStatus.mockResolvedValue({ pinSet: false, attemptsLeft: 5, lockedUntil: null });
    const { result } = await render();
    await waitFor(() => expect(result.current.pinMissing).toBe(true));
    expect(result.current.disabled).toBe(true);
  });
});
