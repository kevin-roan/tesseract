import { useCallback, useEffect, useRef, useState, type WheelEvent } from "react";

const EDGE_TOLERANCE = 1;

export function useSegmentScroll(enabled: boolean, value: string | null) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [fades, setFades] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const track = ref.current;
    if (!track) return;
    const start = track.scrollLeft > EDGE_TOLERANCE;
    const end = track.scrollLeft + track.clientWidth < track.scrollWidth - EDGE_TOLERANCE;
    setFades((current) => (current.start === start && current.end === end ? current : { start, end }));
  }, []);

  useEffect(() => {
    const track = ref.current;
    if (!enabled || !track || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, [enabled, measure]);

  useEffect(() => {
    const track = ref.current;
    if (!enabled || !track) return;
    measure();
    const segment = track.querySelector<HTMLElement>("[data-checked]");
    if (!segment) return;
    const left = segment.offsetLeft - (track.clientWidth - segment.offsetWidth) / 2;
    track.scrollTo?.({ left, behavior: "smooth" });
  }, [enabled, value, measure]);

  const onWheel = useCallback(
    (event: WheelEvent<HTMLDivElement>) => {
      if (enabled && event.deltaX === 0) event.currentTarget.scrollLeft += event.deltaY;
    },
    [enabled],
  );

  return {
    ref,
    fadeStart: enabled && fades.start,
    fadeEnd: enabled && fades.end,
    onWheel: enabled ? onWheel : undefined,
    onScroll: enabled ? measure : undefined,
  };
}
