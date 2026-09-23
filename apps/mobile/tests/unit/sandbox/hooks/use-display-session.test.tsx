import { act, renderHook, waitFor } from "@testing-library/react-native";
import { TheOneClient } from "@theone/client";
import type { DisplayStatus } from "@theone/protocol";
import { sampleDisplay } from "@theone/protocol/fixtures";

import { useDisplaySession } from "@/features/sandbox/hooks/use-display-session";

import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../helpers";

jest.mock("@theone/client", () => ({ ...jest.requireActual("@theone/client"), TheOneClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TheOneClient as unknown as jest.Mock;
const PAGE_1 = "http://127.0.0.1:7700/ui/vnc#ticket=t1&password=vncpass1";
const PAGE_2 = "http://127.0.0.1:7700/ui/vnc#ticket=t2&password=vncpass1";
const NO_DISPLAY: DisplayStatus = { ...sampleDisplay, available: false, width: null, height: null };
const NO_VNC: DisplayStatus = { ...sampleDisplay, vnc: { ...sampleDisplay.vnc, available: false } };
const fake = { displayStatus: jest.fn(), vncPageUrl: jest.fn() };

const renderDisplay = () => renderHook(() => useDisplaySession(), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  fake.displayStatus.mockReset().mockResolvedValue(sampleDisplay);
  fake.vncPageUrl.mockReset().mockResolvedValueOnce(PAGE_1).mockResolvedValue(PAGE_2);
  MockClient.mockReset().mockImplementation(() => fake);
});

describe("useDisplaySession", () => {
  it("opens the noVNC page when the display and VNC are both up", async () => {
    const { result } = await renderDisplay();

    await waitFor(() => expect(result.current.session.url).toBe(PAGE_1));
    expect(result.current.outage).toBeNull();
    expect(result.current.subtitle).toBe(":1 · 1600×900");
    expect(result.current.badge).toEqual({ label: "Loading", tone: "neutral" });
  });

  it("explains a missing X display without requesting a page", async () => {
    fake.displayStatus.mockResolvedValue(NO_DISPLAY);
    const { result } = await renderDisplay();

    await waitFor(() => expect(result.current.outage?.reason).toBe("display"));
    expect(result.current.outage?.title).toBe("The display is not running");
    expect(result.current.outage?.message).toContain(":1");
    expect(result.current.badge).toEqual({ label: "Offline", tone: "danger" });
    expect(result.current.session.url).toBeNull();
    expect(fake.vncPageUrl).not.toHaveBeenCalled();
  });

  it("explains a missing VNC server even though the display is up", async () => {
    fake.displayStatus.mockResolvedValue(NO_VNC);
    const { result } = await renderDisplay();

    await waitFor(() => expect(result.current.outage?.reason).toBe("vnc"));
    expect(result.current.outage?.message).toContain("5901");
    expect(fake.vncPageUrl).not.toHaveBeenCalled();
  });

  it("drops the used page URL during an outage and opens a fresh one after a successful recheck", async () => {
    const { result } = await renderDisplay();
    await waitFor(() => expect(result.current.session.url).toBe(PAGE_1));

    fake.displayStatus.mockResolvedValue(NO_VNC);
    await act(async () => result.current.recheck());
    await waitFor(() => expect(result.current.outage?.reason).toBe("vnc"));
    expect(result.current.session.url).toBeNull();

    fake.displayStatus.mockResolvedValue(sampleDisplay);
    await act(async () => result.current.recheck());

    await waitFor(() => expect(result.current.session.url).toBe(PAGE_2));
    expect(result.current.outage).toBeNull();
    expect(fake.vncPageUrl).toHaveBeenCalledTimes(2);
  });

  it("rechecks the status from the header while the page cannot load", async () => {
    fake.displayStatus.mockResolvedValue(NO_DISPLAY);
    const { result } = await renderDisplay();
    await waitFor(() => expect(result.current.outage).not.toBeNull());
    expect(fake.displayStatus).toHaveBeenCalledTimes(1);

    await act(async () => result.current.headerActions[0].onPress());

    await waitFor(() => expect(fake.displayStatus).toHaveBeenCalledTimes(2));
    expect(fake.vncPageUrl).not.toHaveBeenCalled();
  });
});
