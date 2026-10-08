import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "../../components/Toast";
import { connectionController, resetConnectionRuntime } from "../connection";
import { useConnectionRecoveryToast } from "./use-connection-recovery-toast";

const messages = () => useToastStore.getState().queue.map((item) => item.message);

describe("useConnectionRecoveryToast", () => {
  beforeEach(() => useToastStore.setState({ queue: [] }));
  afterEach(() => resetConnectionRuntime());

  it("toasts once when the connection comes back after a loss", () => {
    const store = connectionController().store;
    act(() => store.setState({ status: "offline" }));
    renderHook(() => useConnectionRecoveryToast());
    expect(messages()).toEqual([]);
    act(() => store.setState({ status: "online", config: null, health: { ok: true, version: "1", protocolVersion: 1, sandboxId: "tesseract-sandbox" } }));
    expect(messages()).toEqual(["Connected to tesseract-sandbox"]);
    act(() => store.setState({ status: "online" }));
    expect(messages()).toHaveLength(1);
  });

  it("stays quiet on a normal start", () => {
    const store = connectionController().store;
    act(() => store.setState({ status: "connecting" }));
    renderHook(() => useConnectionRecoveryToast());
    act(() => store.setState({ status: "online" }));
    expect(messages()).toEqual([]);
  });
});
