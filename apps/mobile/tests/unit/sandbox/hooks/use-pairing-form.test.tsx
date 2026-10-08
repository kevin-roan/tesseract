import { act, renderHook } from "@testing-library/react-native";
import { ApiError, NetworkError, ProtocolVersionError, TesseractClient } from "@tesseract/client";
import { buildPairingLink } from "@tesseract/protocol";
import { sampleHealth, sampleStatus } from "@tesseract/protocol/fixtures";

import { usePairingForm } from "@/features/sandbox/hooks/use-pairing-form";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { tokenStorageKey } from "@/features/sandbox/utils/identity";

import { __dump as dumpSecure } from "../../../mocks/expo-secure-store";
import { createTestQueryClient, createWrapper, resetSandboxState } from "../helpers";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));

const MockClient = TesseractClient as unknown as jest.Mock;
const TOKEN = "Zx9-pairing_token.0123456789";
const URL = "https://tesseract-sandbox.tail1234.ts.net";
const probe = { baseUrl: URL, health: jest.fn(), status: jest.fn() };

const renderForm = (initial?: Parameters<typeof usePairingForm>[0]) =>
  renderHook(() => usePairingForm(initial), { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  resetSandboxState();
  useSandboxStore.setState({ hydrated: true });
  probe.health.mockReset().mockResolvedValue(sampleHealth);
  probe.status.mockReset().mockResolvedValue(sampleStatus);
  MockClient.mockReset().mockImplementation(() => probe);
});

describe("usePairingForm", () => {
  it("starts from deep link values when provided", async () => {
    const { result } = await renderForm({ url: URL, token: TOKEN, name: "Studio" });
    expect(result.current.draft).toEqual({ url: URL, token: TOKEN, name: "Studio" });
    expect(result.current.status).toBe("idle");
  });

  it("shows field errors and never contacts a server for an invalid draft", async () => {
    const { result } = await renderForm();

    let paired: unknown;
    await act(async () => {
      paired = await result.current.submit();
    });

    expect(paired).toBeNull();
    expect(result.current.errors).toEqual({ url: "Enter the controller URL.", token: "Enter the pairing token." });
    expect(MockClient).not.toHaveBeenCalled();
  });

  it("clears a field error as soon as the field changes", async () => {
    const { result } = await renderForm();
    await act(async () => {
      await result.current.submit();
    });
    await act(async () => result.current.setField("url", "https://box"));
    expect(result.current.errors.url).toBeUndefined();
    expect(result.current.errors.token).toBeDefined();
  });

  it("validates the controller, then saves and activates the sandbox", async () => {
    const { result } = await renderForm();
    await act(async () => {
      result.current.setField("url", `${URL}/`);
      result.current.setField("token", TOKEN);
    });

    let paired: Awaited<ReturnType<typeof result.current.submit>> = null;
    await act(async () => {
      paired = await result.current.submit();
    });

    expect(MockClient).toHaveBeenCalledWith({ baseUrl: URL, token: TOKEN, timeoutMs: 10_000 });
    expect(probe.health).toHaveBeenCalled();
    expect(probe.status).toHaveBeenCalled();
    expect(paired).toMatchObject({ name: sampleHealth.sandboxId, baseUrl: URL });
    expect(result.current.status).toBe("paired");

    const state = useSandboxStore.getState();
    expect(state.sandboxes).toHaveLength(1);
    expect(state.activeId).toBe(state.sandboxes[0].id);
    expect(dumpSecure()[tokenStorageKey(state.sandboxes[0].id)]).toBe(TOKEN);
  });

  it("explains a rejected token and saves nothing", async () => {
    probe.status.mockRejectedValue(new ApiError(401, "unauthorized", "bad token"));
    const { result } = await renderForm({ url: URL, token: TOKEN, name: "" });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.message).toMatch(/rejected this token/);
    expect(useSandboxStore.getState().sandboxes).toEqual([]);
    expect(dumpSecure()).toEqual({});
  });

  it("explains an unreachable controller", async () => {
    probe.health.mockRejectedValue(new NetworkError("offline"));
    const { result } = await renderForm({ url: URL, token: TOKEN, name: "" });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.message).toMatch(/Tailscale/);
    expect(probe.status).not.toHaveBeenCalled();
  });

  it("refuses a controller that speaks another protocol version", async () => {
    probe.health.mockRejectedValue(new ProtocolVersionError("/v1/health", 2, 1));
    const { result } = await renderForm({ url: URL, token: TOKEN, name: "" });

    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.message).toMatch(/protocol v2 and this app speaks v1/);
    expect(result.current.status).toBe("error");
    expect(probe.status).not.toHaveBeenCalled();
    expect(useSandboxStore.getState().sandboxes).toHaveLength(0);
  });

  it("fills the form from a scanned or pasted pairing link", async () => {
    const link = buildPairingLink({ url: URL, token: TOKEN, name: "Studio" });
    const { result } = await renderForm();

    let draft: unknown;
    await act(async () => {
      draft = result.current.applyLink(link);
    });
    expect(draft).toEqual({ url: URL, token: TOKEN, name: "Studio" });
    expect(result.current.draft).toEqual(draft);

    await act(async () => result.current.setField("url", ""));
    await act(async () => result.current.setField("url", link));
    expect(result.current.draft).toEqual({ url: URL, token: TOKEN, name: "Studio" });
  });

  it("reports codes that are not pairing links", async () => {
    const { result } = await renderForm();
    let draft: unknown;
    await act(async () => {
      draft = result.current.applyLink("https://example.com/menu");
    });
    expect(draft).toBeNull();
    expect(result.current.status).toBe("error");
    expect(result.current.message).toMatch(/not a Tesseract pairing link/);
  });

  it("submits an explicit draft from a scan without waiting for a re-render", async () => {
    const { result } = await renderForm();
    await act(async () => {
      await result.current.submit({ url: URL, token: TOKEN, name: "Scanned" });
    });
    expect(useSandboxStore.getState().sandboxes[0]?.name).toBe("Scanned");
  });
});
