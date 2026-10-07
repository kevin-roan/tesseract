import { useCallback, useEffect, useMemo, useRef, type PointerEvent } from "react";
import { prepareCanvas, reducedMotion, useCanvasSize, useLatest, useThemeSignature } from "./canvas";
import { CHART, FALLBACK_FONT } from "./constants";
import { paintChart, type ChartColors } from "./paint";
import { niceCeiling } from "./scale";
import { Tween } from "./tween";
import type { ChartSeries, ChartThreshold } from "./types";

export interface TimeSeriesChartOptions {
  series: readonly ChartSeries[];
  hidden: readonly string[];
  durationS: number;
  height: number;
  floor: number;
  format(value: number): string;
  emptyLabel: string;
  nowLabel: string;
  missingLabel: string;
  clock(): number;
  threshold: ChartThreshold | null;
  pointerTime: number | null;
}

const monotonicSeconds = () => performance.now() / 1000;

function visiblePeak(series: readonly ChartSeries[], hidden: ReadonlySet<string>, start: number, end: number): number {
  let peak = 0;
  for (const item of series) {
    if (hidden.has(item.key)) continue;
    for (const [t, value] of item.points) {
      if (value !== null && Number.isFinite(value) && t >= start && t <= end && value > peak) peak = value;
    }
  }
  return peak;
}

export function useTimeSeriesChart(options: TimeSeriesChartOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(containerRef, options.height);
  const theme = useThemeSignature();
  const latest = useLatest(options);
  const hiddenKey = options.hidden.join("\u0000");
  const hidden = useMemo(() => new Set(hiddenKey ? hiddenKey.split("\u0000") : []), [hiddenKey]);

  const duration = useRef(new Tween(options.durationS));
  const ceiling = useRef(new Tween(options.floor));
  const alphas = useRef(new Map<string, Tween>());
  const mounted = useRef(false);
  const frame = useRef<number | null>(null);
  const pointer = useRef<number | null>(null);
  const drawnEnd = useRef(0);
  const sizeRef = useLatest(size);
  const hiddenRef = useLatest(hidden);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const current = sizeRef.current;
    if (!canvas || current.width <= 0) return;
    const ctx = prepareCanvas(canvas, current);
    if (!ctx) return;
    const props = latest.current;
    const now = monotonicSeconds();
    const end = props.clock();
    drawnEnd.current = end;
    const style = getComputedStyle(canvas);
    const cache = new Map<string, string>();
    const color = (token: string) => {
      const cached = cache.get(token);
      if (cached !== undefined) return cached;
      const value = style.getPropertyValue(`--to-${token}`).trim();
      cache.set(token, value);
      return value;
    };
    const colors: ChartColors = { color, fontFamily: color("font-sans") || FALLBACK_FONT };
    paintChart(
      ctx,
      {
        width: current.width,
        height: current.height,
        dpr: current.dpr,
        end,
        duration: duration.current.value(now),
        ceiling: ceiling.current.value(now),
        ceilingTarget: ceiling.current.target,
        series: props.series,
        hidden: hiddenRef.current,
        alpha: (key) => alphas.current.get(key)?.value(now) ?? 1,
        threshold: props.threshold,
        pointerX: pointer.current,
        pointerTime: props.pointerTime,
        format: props.format,
        emptyLabel: props.emptyLabel,
        nowLabel: props.nowLabel,
        missingLabel: props.missingLabel,
      },
      colors,
    );
  }, [latest, sizeRef, hiddenRef]);

  const animate = useCallback(() => {
    if (frame.current !== null) return;
    const step = () => {
      paint();
      const now = monotonicSeconds();
      const running =
        duration.current.running(now) || ceiling.current.running(now) || [...alphas.current.values()].some((tween) => tween.running(now));
      frame.current = running ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
  }, [paint]);

  const retarget = useCallback(
    (now: number, allowMotion: boolean) => {
      const props = latest.current;
      const end = props.clock();
      const start = end - duration.current.target;
      ceiling.current.set(niceCeiling(visiblePeak(props.series, hiddenRef.current, start, end), props.floor), now, allowMotion);
    },
    [latest, hiddenRef],
  );

  useEffect(() => {
    const now = monotonicSeconds();
    const allowMotion = mounted.current && !reducedMotion();
    for (const item of options.series) {
      if (!alphas.current.has(item.key)) alphas.current.set(item.key, new Tween(hidden.has(item.key) ? 0 : 1));
    }
    for (const [key, tween] of alphas.current) tween.set(hidden.has(key) ? 0 : 1, now, allowMotion);
    duration.current.set(options.durationS, now, allowMotion);
    retarget(now, allowMotion);
    if (allowMotion) animate();
    else paint();
  }, [options.series, hidden, options.durationS, options.floor, retarget, animate, paint]);

  useEffect(() => {
    paint();
    mounted.current = true;
  }, [paint, size, theme, options.threshold, options.pointerTime, options.emptyLabel, options.nowLabel, options.missingLabel, options.format]);

  useEffect(() => {
    const timer = setInterval(() => {
      const secondsPerPixel = duration.current.target / Math.max(1, sizeRef.current.width);
      if (latest.current.clock() - drawnEnd.current >= secondsPerPixel) paint();
    }, CHART.redrawIntervalMs);
    return () => {
      clearInterval(timer);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      mounted.current = false;
    };
  }, [paint, latest, sizeRef]);

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      pointer.current = event.clientX - event.currentTarget.getBoundingClientRect().left;
      paint();
    },
    [paint],
  );

  const onPointerLeave = useCallback(() => {
    pointer.current = null;
    paint();
  }, [paint]);

  return { containerRef, canvasRef, onPointerMove, onPointerLeave };
}
