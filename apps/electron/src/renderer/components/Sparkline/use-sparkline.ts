import { useEffect, useRef } from "react";
import type { SemanticColor } from "../../theme/colors";
import { chartColorToken } from "../TimeSeriesChart/constants";
import { cssColor, prepareCanvas, useCanvasSize, useThemeSignature, withAlpha } from "../TimeSeriesChart/canvas";
import { SPARKLINE } from "./constants";
import { sparklinePoints } from "./geometry";

export interface SparklineOptions {
  values: readonly number[];
  color: SemanticColor | number;
  maxPoints: number;
  min: number | null;
  max: number | null;
  fill: boolean;
  height: number;
}

export function useSparkline({ values, color, maxPoints, min, max, fill, height }: SparklineOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(containerRef, height);
  const theme = useThemeSignature();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width <= 0) return;
    const ctx = prepareCanvas(canvas, size);
    if (!ctx) return;
    const points = sparklinePoints({ values, width: size.width, height: size.height, maxPoints, min, max });
    const [first] = points;
    const last = points[points.length - 1];
    if (!first || !last) return;
    const stroke = cssColor(canvas, typeof color === "number" ? chartColorToken(color) : color);
    ctx.lineWidth = SPARKLINE.lineWidth;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(first[0], first[1]);
    for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    if (fill) {
      ctx.save();
      ctx.lineTo(last[0], size.height);
      ctx.lineTo(first[0], size.height);
      ctx.closePath();
      ctx.fillStyle = withAlpha(stroke, SPARKLINE.fillAlpha);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(first[0], first[1]);
      for (const [x, y] of points.slice(1)) ctx.lineTo(x, y);
    }
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }, [values, color, maxPoints, min, max, fill, size, theme]);

  return { containerRef, canvasRef };
}
