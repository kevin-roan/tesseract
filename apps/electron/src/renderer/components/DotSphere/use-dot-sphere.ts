import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { SemanticColor } from "../../theme/colors";
import { cssColor, prepareCanvas, useReducedMotionPreference, useThemeSignature, withAlpha } from "../TimeSeriesChart/canvas";
import { DOT_SPHERE } from "./constants";
import { bandOpacity, dotRadiusFor, frameAngle, sphereDots, spherePoints, TURN } from "./geometry";

export interface DotSphereOptions {
  size: number;
  dots: number;
  color: SemanticColor;
  spinning: boolean;
  periodMs: number;
}

function useInView(ref: RefObject<Element | null>): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setVisible(entries.some((entry) => entry.isIntersecting)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}

export function useDotSphere({ size, dots, color, spinning, periodMs }: DotSphereOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angle = useRef(0);
  const points = useMemo(() => spherePoints(dots), [dots]);
  const theme = useThemeSignature();
  const reduced = useReducedMotionPreference();
  const visible = useInView(canvasRef);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = prepareCanvas(canvas, { width: size, height: size, dpr: globalThis.devicePixelRatio || 1 });
    if (!ctx) return;
    const dotRadius = dotRadiusFor(size);
    const center = size / 2;
    const base = cssColor(canvas, color);
    const placed = sphereDots(points, angle.current, center, center - dotRadius, dotRadius);
    for (let band = 0; band < DOT_SPHERE.depthBands; band += 1) {
      ctx.fillStyle = withAlpha(base, bandOpacity(band));
      ctx.beginPath();
      for (const dot of placed) {
        if (dot.band !== band) continue;
        ctx.moveTo(dot.x + dot.radius, dot.y);
        ctx.arc(dot.x, dot.y, dot.radius, 0, TURN);
      }
      ctx.fill();
    }
  }, [size, color, points]);

  useEffect(() => {
    draw();
  }, [draw, theme]);

  useEffect(() => {
    if (!spinning || reduced || !visible) return;
    let frame = requestAnimationFrame(function tick(now) {
      const next = frameAngle(now, periodMs);
      if (next !== angle.current) {
        angle.current = next;
        draw();
      }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [spinning, reduced, visible, periodMs, draw]);

  return { canvasRef };
}
