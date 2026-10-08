import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";
import { TesseractClient } from "@tesseract/client";
import { sampleUpload } from "@tesseract/protocol/fixtures";

import AttachmentTray from "@/features/attachments/components/attachment-tray";
import { base64FromDataUrl } from "@/features/attachments/utils/files";
import ChatComposer from "@/features/chat/components/chat-composer";
import { useChatComposer } from "@/features/chat/hooks/use-chat-composer";

import { __emitChange, __reset as resetClipboard, getImageAsync, hasImageAsync } from "../../mocks/expo-clipboard";
import { __reset as resetFiles, files } from "../../mocks/expo-file-system";
import { createTestQueryClient, createWrapper, resetSandboxState, seedActiveSandbox } from "../sandbox/helpers";
import { chatComposerState } from "./fixtures";

jest.mock("@tesseract/client", () => ({ ...jest.requireActual("@tesseract/client"), TesseractClient: jest.fn() }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const MockClient = TesseractClient as unknown as jest.Mock;
const fake = { createUpload: jest.fn() };
const PNG = "iVBORw0KGgo=";
const optionIds = (options: { id: string }[]) => options.map((option) => option.id);

let appStateListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  resetSandboxState();
  seedActiveSandbox();
  resetClipboard();
  resetFiles();
  fake.createUpload.mockReset().mockResolvedValue(sampleUpload);
  MockClient.mockReset().mockImplementation(() => fake);
  appStateListener = null;
  jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
    appStateListener = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => jest.restoreAllMocks());

const renderComposer = () =>
  renderHook(() => useChatComposer({ onStarted: jest.fn() }), { wrapper: createWrapper(createTestQueryClient()) });

describe("clipboard image paste in useChatComposer", () => {
  it("offers nothing until the input is focused with an image on the clipboard", async () => {
    const { result } = await renderComposer();
    expect(result.current.clipboard.canPaste).toBe(false);
    expect(optionIds(result.current.attach.options)).not.toContain("clipboard");

    await act(async () => result.current.clipboard.onFocus());
    expect(hasImageAsync).toHaveBeenCalledTimes(1);
    expect(result.current.clipboard.canPaste).toBe(false);

    hasImageAsync.mockResolvedValue(true);
    await act(async () => result.current.clipboard.onFocus());
    expect(result.current.clipboard.canPaste).toBe(true);
    expect(optionIds(result.current.attach.options)).toContain("clipboard");
  });

  it("pastes the image through the upload path and hides the chip until the clipboard changes", async () => {
    hasImageAsync.mockResolvedValue(true);
    getImageAsync.mockResolvedValue({ data: `data:image/png;base64,${PNG}`, size: { width: 1, height: 1 } });
    const { result } = await renderComposer();

    await act(async () => result.current.clipboard.onFocus());
    await act(async () => result.current.clipboard.paste());
    await waitFor(() => expect(result.current.attachments.items[0]?.status).toBe("ready"));

    const item = result.current.attachments.items[0]!;
    expect(getImageAsync).toHaveBeenCalledWith({ format: "png" });
    expect(item).toMatchObject({ kind: "image", mimeType: "image/png" });
    expect(item.uri).toMatch(/^file:\/\/\/cache\/pasted-image-.+\.png$/);
    expect(files[item.uri]?.base64).toBe(PNG);
    expect(fake.createUpload).toHaveBeenCalledWith(
      { name: item.name, mimeType: "image/png", data: PNG },
      expect.objectContaining({ timeoutMs: expect.any(Number) }),
    );
    expect(result.current.clipboard.canPaste).toBe(false);

    await act(async () => result.current.clipboard.onFocus());
    expect(result.current.clipboard.canPaste).toBe(false);

    await act(async () => __emitChange());
    expect(result.current.clipboard.canPaste).toBe(true);
  });

  it("pastes from the attach menu after the sheet closes", async () => {
    hasImageAsync.mockResolvedValue(true);
    getImageAsync.mockResolvedValue({ data: `data:image/png;base64,${PNG}`, size: { width: 1, height: 1 } });
    const { result } = await renderComposer();

    await act(async () => result.current.openSheet("attach"));
    expect(optionIds(result.current.attach.options)).toContain("clipboard");
    await act(async () => result.current.attach.select("clipboard"));
    expect(getImageAsync).not.toHaveBeenCalled();
    await act(async () => result.current.onSheetDismissed());

    await waitFor(() => expect(result.current.attachments.items[0]?.status).toBe("ready"));
    expect(result.current.clipboard.canPaste).toBe(false);
    expect(optionIds(result.current.attach.options)).toContain("clipboard");
  });

  it("offers a new copy again after the app was only inactive (iOS screenshot overlay)", async () => {
    hasImageAsync.mockResolvedValue(true);
    getImageAsync.mockResolvedValue({ data: `data:image/png;base64,${PNG}`, size: { width: 1, height: 1 } });
    const { result } = await renderComposer();

    await act(async () => result.current.clipboard.onFocus());
    await act(async () => result.current.clipboard.paste());
    expect(result.current.clipboard.canPaste).toBe(false);

    await act(async () => appStateListener?.("inactive"));
    await act(async () => appStateListener?.("active"));
    expect(result.current.clipboard.canPaste).toBe(true);
  });

  it("shows a notice when the image is gone by the time it is pasted", async () => {
    hasImageAsync.mockResolvedValue(true);
    const { result } = await renderComposer();

    await act(async () => result.current.clipboard.onFocus());
    await act(async () => result.current.clipboard.paste());

    expect(result.current.attachments.items).toEqual([]);
    expect(result.current.error).toBe("There's no image on the clipboard to paste.");
    expect(fake.createUpload).not.toHaveBeenCalled();
  });

  it("checks again when the app returns from the background while the input is focused", async () => {
    const { result } = await renderComposer();
    await act(async () => result.current.clipboard.onFocus());
    expect(result.current.clipboard.canPaste).toBe(false);

    hasImageAsync.mockResolvedValue(true);
    await act(async () => appStateListener?.("background"));
    await act(async () => appStateListener?.("active"));
    expect(result.current.clipboard.canPaste).toBe(true);

    hasImageAsync.mockClear();
    await act(async () => result.current.clipboard.onBlur());
    await act(async () => appStateListener?.("background"));
    await act(async () => appStateListener?.("active"));
    expect(hasImageAsync).not.toHaveBeenCalled();
  });
});

describe("clipboard paste UI", () => {
  it("shows a paste chip in the tray and reports taps", async () => {
    const onPaste = jest.fn();
    await render(<AttachmentTray items={[]} onRemove={jest.fn()} onRetry={jest.fn()} onPaste={onPaste} />);
    fireEvent.press(screen.getByLabelText("Paste image"));
    expect(onPaste).toHaveBeenCalled();
  });

  it("forwards input focus and only shows the chip when pasting is possible", async () => {
    const hidden = chatComposerState();
    const { rerender } = await render(<ChatComposer composer={hidden} placeholder="Message" />);
    expect(screen.queryByLabelText("Paste image")).toBeNull();
    fireEvent(screen.getByLabelText("Message"), "focus");
    expect(hidden.clipboard.onFocus).toHaveBeenCalled();

    const shown = chatComposerState({ clipboard: { ...hidden.clipboard, canPaste: true } });
    await rerender(<ChatComposer composer={shown} placeholder="Message" />);
    fireEvent.press(screen.getByLabelText("Paste image"));
    expect(shown.clipboard.paste).toHaveBeenCalled();
  });
});

describe("base64FromDataUrl", () => {
  it("strips a data URL prefix and keeps bare base64", () => {
    expect(base64FromDataUrl(`data:image/png;base64,${PNG}`)).toBe(PNG);
    expect(base64FromDataUrl(PNG)).toBe(PNG);
  });
});
