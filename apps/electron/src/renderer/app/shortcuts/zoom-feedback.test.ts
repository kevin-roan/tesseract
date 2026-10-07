import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "../../components/Toast";
import { announceZoom, rememberZoom, resetZoomFeedback } from "./zoom-feedback";

const messages = () => useToastStore.getState().queue.map((item) => item.message);

describe("zoom feedback", () => {
  beforeEach(() => {
    resetZoomFeedback();
    useToastStore.setState({ queue: [] });
  });
  afterEach(() => resetZoomFeedback());

  it("toasts only when the zoom changes and replaces the previous toast", () => {
    rememberZoom(1);
    announceZoom(1);
    expect(messages()).toEqual([]);
    announceZoom(1.1);
    announceZoom(1.25);
    expect(messages()).toEqual(["Zoom 125%"]);
    announceZoom(1.25);
    expect(messages()).toEqual(["Zoom 125%"]);
  });

  it("always toasts a forced announcement", () => {
    rememberZoom(1);
    announceZoom(1, true);
    expect(messages()).toEqual(["Zoom 100%"]);
  });
});
