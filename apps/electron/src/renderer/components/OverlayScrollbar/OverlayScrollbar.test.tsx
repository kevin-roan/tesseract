import { act, fireEvent, render } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { OVERLAY_SCROLL_ATTRIBUTE, OVERLAY_SCROLLBAR } from "./constants";
import { scrollPerThumbPixel, thumbLength, thumbOffset } from "./model";
import { OverlayScrollbar } from "./OverlayScrollbar";

function define(element: HTMLElement, values: Record<string, number>) {
  for (const [key, value] of Object.entries(values)) Object.defineProperty(element, key, { configurable: true, value });
}

function Harness({ scrollable }: { scrollable: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div
        ref={(node) => {
          ref.current = node;
          if (node) define(node, { clientHeight: 100, clientWidth: 300, scrollHeight: scrollable ? 400 : 100 });
        }}
        data-testid="scroller"
      />
      <OverlayScrollbar target={ref} />
    </div>
  );
}

describe("overlay scrollbar model", () => {
  const metrics = { scrollTop: 0, scrollHeight: 400, clientHeight: 100 };

  it("sizes the thumb to the visible fraction with a minimum", () => {
    expect(thumbLength(metrics)).toBeCloseTo(24);
    expect(thumbLength({ ...metrics, scrollHeight: 150 })).toBeCloseTo((96 * 100) / 150);
    expect(thumbLength({ ...metrics, scrollHeight: 100 })).toBeNull();
  });

  it("maps scroll progress onto the track inside the margins", () => {
    expect(thumbOffset(metrics, 24)).toBe(OVERLAY_SCROLLBAR.marginPx);
    expect(thumbOffset({ ...metrics, scrollTop: 300 }, 24)).toBe(OVERLAY_SCROLLBAR.marginPx + 72);
    expect(scrollPerThumbPixel(metrics, 24)).toBeCloseTo(300 / 72);
  });
});

describe("OverlayScrollbar", () => {
  it("hides the native scrollbar and draws a thumb only when content overflows", () => {
    const { container, getByTestId, unmount } = render(<Harness scrollable />);
    const scroller = getByTestId("scroller");
    expect(scroller.hasAttribute(OVERLAY_SCROLL_ATTRIBUTE)).toBe(true);
    const thumb = container.querySelector("[data-overlay-scrollbar] > div") as HTMLElement;
    expect(thumb.style.height).toBe("24px");
    expect(thumb.hasAttribute("data-visible")).toBe(false);
    act(() => {
      fireEvent.scroll(scroller);
    });
    expect(thumb.hasAttribute("data-visible")).toBe(true);
    unmount();
    expect(scroller.hasAttribute(OVERLAY_SCROLL_ATTRIBUTE)).toBe(false);
  });

  it("renders nothing without overflow", () => {
    const { container } = render(<Harness scrollable={false} />);
    expect(container.querySelector("[data-overlay-scrollbar]")).toBeNull();
  });
});
