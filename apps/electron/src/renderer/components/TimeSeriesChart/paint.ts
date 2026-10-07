import { CHART, chartColorToken, TABULAR_ADVANCE_EM } from "./constants";
import { bezierControls, crisp, nearest, splitSegments, timeLabel, timeStep, timeTicks, valueTicks } from "./scale";
import { withAlpha } from "./canvas";
import type { ChartSeries, ChartThreshold, XY } from "./types";

export interface ChartColors {
  color(token: string): string;
  fontFamily: string;
}

export interface ChartFrame {
  width: number;
  height: number;
  dpr: number;
  end: number;
  duration: number;
  ceiling: number;
  ceilingTarget: number;
  series: readonly ChartSeries[];
  hidden: ReadonlySet<string>;
  alpha(key: string): number;
  threshold: ChartThreshold | null;
  pointerX: number | null;
  pointerTime: number | null;
  format(value: number): string;
  emptyLabel: string;
  nowLabel: string;
  missingLabel: string;
}

export interface Plot {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  start: number;
  end: number;
  ceiling: number;
}

interface TextLayout {
  text: string;
  font: string;
  width: number;
  height: number;
  ascent: number;
  glyphs: readonly { char: string; offset: number }[];
}

type Drawn = { series: ChartSeries; alpha: number };

export const plotWidth = (plot: Plot) => plot.x1 - plot.x0;
export const plotHeight = (plot: Plot) => plot.y1 - plot.y0;
export const plotX = (plot: Plot, t: number) => plot.x0 + ((t - plot.start) / Math.max(1e-6, plot.end - plot.start)) * plotWidth(plot);
export const plotT = (plot: Plot, x: number) => plot.start + ((x - plot.x0) / Math.max(1e-6, plotWidth(plot))) * (plot.end - plot.start);
export const plotY = (plot: Plot, value: number) => plot.y1 - (value / Math.max(1e-6, plot.ceiling)) * plotHeight(plot);

function fontOf(colors: ChartColors, size: number, bold = false): string {
  return `${bold ? CHART.fontWeightBold : CHART.fontWeightNormal} ${size}px ${colors.fontFamily}`;
}

function layout(ctx: CanvasRenderingContext2D, colors: ChartColors, text: string, size: number = CHART.labelSize, bold = false): TextLayout {
  const font = fontOf(colors, size, bold);
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const ascent = metrics.fontBoundingBoxAscent || size * 0.97;
  const descent = metrics.fontBoundingBoxDescent || size * 0.25;
  const { glyphs, width } = tabularGlyphs(ctx, text, size);
  return { text, font, width: Math.ceil(width), height: Math.ceil(ascent + descent), ascent, glyphs };
}

function tabularGlyphs(ctx: CanvasRenderingContext2D, text: string, size: number) {
  const runs = text.match(/[0-9:]|[^0-9:]+/g) ?? [];
  const glyphs: { char: string; offset: number }[] = [];
  let width = 0;
  for (const run of runs) {
    const natural = ctx.measureText(run).width;
    const tabular = TABULAR_ADVANCE_EM[run];
    const cell = tabular === undefined ? natural : tabular * size;
    glyphs.push({ char: run, offset: width + (cell - natural) / 2 });
    width += cell;
  }
  return { glyphs, width };
}

function drawText(ctx: CanvasRenderingContext2D, text: TextLayout, x: number, y: number, color: string): void {
  ctx.font = text.font;
  ctx.fillStyle = color;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  for (const glyph of text.glyphs) ctx.fillText(glyph.char, x + glyph.offset, y + text.ascent);
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

export function seriesColor(colors: ChartColors, series: ChartSeries): string {
  return colors.color(chartColorToken(series.color));
}

export function computePlot(ctx: CanvasRenderingContext2D, frame: ChartFrame, colors: ChartColors) {
  const ticks = valueTicks(frame.ceilingTarget).filter((value) => value <= frame.ceiling + 1e-9);
  const yLabels = ticks.map((value) => ({ value, text: layout(ctx, colors, frame.format(value)) }));
  const labelWidth = yLabels.reduce((max, label) => Math.max(max, label.text.width), 0);
  const labelHeight = layout(ctx, colors, "0").height;
  const plot: Plot = {
    x0: labelWidth + CHART.axisGap,
    y0: CHART.padTop,
    x1: frame.width - CHART.padRight,
    y1: frame.height - labelHeight - CHART.axisGap - CHART.padBottom,
    start: frame.end - frame.duration,
    end: frame.end,
    ceiling: frame.ceiling,
  };
  return { plot, yLabels, labelHeight };
}

export function paintChart(ctx: CanvasRenderingContext2D, frame: ChartFrame, colors: ChartColors): Plot | null {
  const { plot, yLabels, labelHeight } = computePlot(ctx, frame, colors);
  if (plotWidth(plot) <= 0 || plotHeight(plot) <= 0) return null;
  const label = colors.color("text-tertiary");

  paintGrid(ctx, plot, yLabels, labelHeight, frame.dpr, colors, label);
  paintTimeAxis(ctx, plot, frame.nowLabel, colors, label);
  paintThreshold(ctx, plot, frame.threshold, frame.dpr, colors, label);

  const drawn: Drawn[] = frame.series
    .map((series) => ({ series, alpha: frame.alpha(series.key) }))
    .filter((item) => item.alpha > CHART.hiddenAlpha);
  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.x0, 0, plotWidth(plot), plot.y1 + CHART.lineWidth);
  ctx.clip();
  for (const item of [...drawn].reverse()) paintSeries(ctx, plot, item, colors);
  ctx.restore();
  paintLatest(ctx, plot, drawn, colors);

  const densest = drawn
    .filter((item) => !frame.hidden.has(item.series.key))
    .reduce(
      (max, item) =>
        Math.max(max, item.series.points.filter(([t, v]) => v !== null && t >= plot.start && t <= plot.end).length),
      0,
    );
  if (densest < 2) paintEmpty(ctx, plot, frame.emptyLabel, colors, label);
  else {
    const pointerX = frame.pointerX ?? (frame.pointerTime !== null ? plotX(plot, frame.pointerTime) : null);
    if (pointerX !== null) paintHover(ctx, plot, frame, pointerX, drawn, colors, label);
  }
  return plot;
}

function paintGrid(
  ctx: CanvasRenderingContext2D,
  plot: Plot,
  yLabels: { value: number; text: TextLayout }[],
  labelHeight: number,
  dpr: number,
  colors: ChartColors,
  label: string,
): void {
  ctx.lineWidth = CHART.gridWidth;
  ctx.setLineDash([]);
  for (const { value, text } of yLabels) {
    const y = crisp(plotY(plot, value), dpr, CHART.gridWidth);
    const baseline = value === 0 || (value === 1 && plot.ceiling > 1);
    ctx.strokeStyle = colors.color(baseline ? "chart-axis" : "chart-grid");
    ctx.beginPath();
    ctx.moveTo(plot.x0, y);
    ctx.lineTo(plot.x1, y);
    ctx.stroke();
    drawText(ctx, text, plot.x0 - CHART.axisGap - text.width, plotY(plot, value) - labelHeight / 2, label);
  }
}

function paintTimeAxis(ctx: CanvasRenderingContext2D, plot: Plot, nowLabel: string, colors: ChartColors, label: string): void {
  const maxTicks = Math.max(1, Math.floor(plotWidth(plot) / CHART.minTickSpacing));
  const step = timeStep(plot.end - plot.start, maxTicks);
  const labelY = plot.y1 + CHART.axisGap;
  let rightLimit = plot.x1;
  if (nowLabel) {
    const now = layout(ctx, colors, nowLabel);
    drawText(ctx, now, plot.x1 - now.width, labelY, label);
    rightLimit = plot.x1 - now.width - CHART.labelGap;
  }
  let lastRight = -Infinity;
  for (const tick of timeTicks(plot.start, plot.end, maxTicks)) {
    const x = plotX(plot, tick);
    if (x < plot.x0 || x > plot.x1) continue;
    const text = layout(ctx, colors, timeLabel(tick, step));
    const left = Math.min(Math.max(x - text.width / 2, plot.x0), plot.x1 - text.width);
    if (left < lastRight + CHART.labelGap || left + text.width > rightLimit) continue;
    drawText(ctx, text, left, labelY, label);
    lastRight = left + text.width;
  }
}

function paintThreshold(
  ctx: CanvasRenderingContext2D,
  plot: Plot,
  threshold: ChartThreshold | null,
  dpr: number,
  colors: ChartColors,
  label: string,
): void {
  if (!threshold || threshold.value > plot.ceiling) return;
  const y = crisp(plotY(plot, threshold.value), dpr, CHART.gridWidth);
  ctx.save();
  ctx.lineWidth = CHART.gridWidth;
  ctx.setLineDash([...CHART.thresholdDash]);
  ctx.strokeStyle = withAlpha(colors.color("warning-solid"), CHART.thresholdAlpha);
  ctx.beginPath();
  ctx.moveTo(plot.x0, y);
  ctx.lineTo(plot.x1, y);
  ctx.stroke();
  ctx.restore();
  const text = layout(ctx, colors, threshold.label);
  const left = plot.x1 - text.width - CHART.platePadding;
  const top = y - text.height - CHART.platePadding;
  roundedRect(ctx, left - CHART.platePadding, top, text.width + 2 * CHART.platePadding, text.height, text.height / 2);
  ctx.fillStyle = withAlpha(colors.color("surface-elevated"), CHART.plateAlpha);
  ctx.fill();
  drawText(ctx, text, left, top, label);
}

function segmentPath(ctx: CanvasRenderingContext2D, points: XY[]): void {
  const [first] = points;
  if (!first) return;
  ctx.moveTo(first[0], first[1]);
  for (const [[c1x, c1y], [c2x, c2y], [x, y]] of bezierControls(points)) ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
}

function paintSeries(ctx: CanvasRenderingContext2D, plot: Plot, { series, alpha }: Drawn, colors: ChartColors): void {
  const color = seriesColor(colors, series);
  const margin = plot.end - plot.start;
  for (const segment of splitSegments(series.points)) {
    const firstT = segment[0]?.[0] ?? 0;
    const lastT = segment[segment.length - 1]?.[0] ?? 0;
    if (lastT < plot.start - margin || firstT > plot.end) continue;
    const points: XY[] = segment.map(([t, v]) => [plotX(plot, t), plotY(plot, v)]);
    const [first] = points;
    if (!first) continue;
    if (points.length === 1) {
      ctx.fillStyle = withAlpha(color, alpha);
      ctx.beginPath();
      ctx.arc(first[0], first[1], CHART.isolatedRadius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    if (series.fill) {
      const last = points[points.length - 1] ?? first;
      ctx.beginPath();
      segmentPath(ctx, points);
      ctx.lineTo(last[0], plot.y1);
      ctx.lineTo(first[0], plot.y1);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, plot.y0, 0, plot.y1);
      gradient.addColorStop(0, withAlpha(color, CHART.fillTopAlpha * alpha));
      gradient.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    ctx.beginPath();
    segmentPath(ctx, points);
    ctx.lineWidth = CHART.lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(series.dash ? [...series.dash] : []);
    ctx.strokeStyle = withAlpha(color, alpha);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, alpha: number, colors: ChartColors): void {
  ctx.fillStyle = withAlpha(colors.color("surface"), alpha);
  ctx.beginPath();
  ctx.arc(x, y, CHART.dotRadius + CHART.ringWidth, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = withAlpha(color, alpha);
  ctx.beginPath();
  ctx.arc(x, y, CHART.dotRadius, 0, Math.PI * 2);
  ctx.fill();
}

function paintLatest(ctx: CanvasRenderingContext2D, plot: Plot, drawn: Drawn[], colors: ChartColors): void {
  for (const { series, alpha } of drawn) {
    const last = series.points[series.points.length - 1];
    if (!last || last[1] === null || !Number.isFinite(last[1])) continue;
    const [t, value] = last;
    if (t < plot.start || t > plot.end) continue;
    dot(ctx, plotX(plot, t), plotY(plot, Math.min(value, plot.ceiling)), seriesColor(colors, series), alpha, colors);
  }
}

export function hoverMoment(plot: Plot, frame: Pick<ChartFrame, "series" | "hidden">, pointerX: number): number | null {
  if (pointerX < plot.x0 || pointerX > plot.x1) return null;
  const times = [
    ...new Set(
      frame.series
        .filter((series) => !frame.hidden.has(series.key))
        .flatMap((series) => series.points.filter(([t, v]) => v !== null && t >= plot.start && t <= plot.end).map(([t]) => t)),
    ),
  ].sort((a, b) => a - b);
  const index = nearest(times, plotT(plot, pointerX));
  return index === null ? null : (times[index] ?? null);
}

function paintHover(
  ctx: CanvasRenderingContext2D,
  plot: Plot,
  frame: ChartFrame,
  pointerX: number,
  drawn: Drawn[],
  colors: ChartColors,
  label: string,
): void {
  const moment = hoverMoment(plot, frame, pointerX);
  if (moment === null) return;
  const active = drawn.filter((item) => !frame.hidden.has(item.series.key));
  const x = crisp(plotX(plot, moment), frame.dpr, CHART.gridWidth);
  ctx.lineWidth = CHART.gridWidth;
  ctx.setLineDash([]);
  ctx.strokeStyle = withAlpha(label, CHART.crosshairAlpha);
  ctx.beginPath();
  ctx.moveTo(x, plot.y0);
  ctx.lineTo(x, plot.y1);
  ctx.stroke();
  const rows = active.map(({ series, alpha }) => {
    const point = series.points.find(([t, v]) => t === moment && v !== null);
    const value = point ? point[1] : null;
    const color = seriesColor(colors, series);
    if (value !== null) dot(ctx, plotX(plot, moment), plotY(plot, Math.min(value, plot.ceiling)), color, alpha, colors);
    return { series, color, value: value !== null ? frame.format(value) : frame.missingLabel };
  });
  paintTooltip(ctx, plot, plotX(plot, moment), timeLabel(moment, 1), rows, colors, label, frame.width);
}

function paintTooltip(
  ctx: CanvasRenderingContext2D,
  plot: Plot,
  x: number,
  title: string,
  rows: { series: ChartSeries; color: string; value: string }[],
  colors: ChartColors,
  label: string,
  width: number,
): void {
  const titleLayout = layout(ctx, colors, title, CHART.tooltipTitleSize);
  const rowLayouts = rows.map((row) => ({
    ...row,
    valueLayout: layout(ctx, colors, row.value, CHART.tooltipValueSize, true),
    labelLayout: layout(ctx, colors, row.series.label, CHART.tooltipTitleSize),
  }));
  const valueW = rowLayouts.reduce((max, row) => Math.max(max, row.valueLayout.width), 0);
  const labelW = rowLayouts.reduce((max, row) => Math.max(max, row.labelLayout.width), 0);
  const rowH = rowLayouts.reduce((max, row) => Math.max(max, row.valueLayout.height), rowLayouts.length ? 0 : titleLayout.height);
  const pad = CHART.tooltipPadding;
  const gap = CHART.tooltipInnerGap;
  const boxW = pad * 2 + Math.max(titleLayout.width, CHART.tooltipKeyWidth + gap + valueW + gap + labelW);
  const boxH = pad * 2 + titleLayout.height + rowLayouts.length * (rowH + CHART.tooltipRowGap);
  let left = x + CHART.tooltipGap;
  if (left + boxW > width - CHART.tooltipEdge) left = x - CHART.tooltipGap - boxW;
  left = Math.max(CHART.tooltipEdge, left);
  const top = plot.y0 + CHART.tooltipTop;
  roundedRect(ctx, left, top, boxW, boxH, CHART.tooltipRadius);
  ctx.fillStyle = colors.color("surface-elevated");
  ctx.fill();
  ctx.strokeStyle = colors.color("border");
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.stroke();
  drawText(ctx, titleLayout, left + pad, top + pad, label);
  let y = top + pad + titleLayout.height + CHART.tooltipRowGap;
  const text = colors.color("text");
  for (const row of rowLayouts) {
    const keyY = y + rowH / 2;
    ctx.lineWidth = CHART.lineWidth + 1;
    ctx.lineCap = "round";
    ctx.setLineDash(row.series.dash ? [...row.series.dash] : []);
    ctx.strokeStyle = row.color;
    ctx.beginPath();
    ctx.moveTo(left + pad + 1, keyY);
    ctx.lineTo(left + pad + CHART.tooltipKeyWidth - 1, keyY);
    ctx.stroke();
    ctx.setLineDash([]);
    const valueX = left + pad + CHART.tooltipKeyWidth + gap;
    drawText(ctx, row.valueLayout, valueX, y, text);
    drawText(ctx, row.labelLayout, valueX + valueW + gap, y + (rowH - row.labelLayout.height) / 2, label);
    y += rowH + CHART.tooltipRowGap;
  }
}

function paintEmpty(ctx: CanvasRenderingContext2D, plot: Plot, emptyLabel: string, colors: ChartColors, label: string): void {
  if (!emptyLabel) return;
  const text = layout(ctx, colors, emptyLabel, CHART.emptySize);
  drawText(ctx, text, plot.x0 + (plotWidth(plot) - text.width) / 2, plot.y0 + (plotHeight(plot) - text.height) / 2, label);
}
