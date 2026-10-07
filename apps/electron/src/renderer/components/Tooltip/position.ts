export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TooltipPosition {
  left: number;
  top: number;
  placement: TooltipPlacement;
}

const OPPOSITE: Record<TooltipPlacement, TooltipPlacement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

function place(anchor: Box, size: Size, placement: TooltipPlacement, gap: number) {
  const centerX = anchor.left + anchor.width / 2 - size.width / 2;
  const centerY = anchor.top + anchor.height / 2 - size.height / 2;
  switch (placement) {
    case "top":
      return { left: centerX, top: anchor.top - gap - size.height };
    case "bottom":
      return { left: centerX, top: anchor.top + anchor.height + gap };
    case "left":
      return { left: anchor.left - gap - size.width, top: centerY };
    case "right":
      return { left: anchor.left + anchor.width + gap, top: centerY };
  }
}

function fits(point: { left: number; top: number }, size: Size, viewport: Size, margin: number) {
  return (
    point.left >= margin &&
    point.top >= margin &&
    point.left + size.width <= viewport.width - margin &&
    point.top + size.height <= viewport.height - margin
  );
}

function fitsMainAxis(point: { left: number; top: number }, size: Size, viewport: Size, margin: number, placement: TooltipPlacement) {
  if (placement === "top" || placement === "bottom") {
    return point.top >= margin && point.top + size.height <= viewport.height - margin;
  }
  return point.left >= margin && point.left + size.width <= viewport.width - margin;
}

export function computeTooltipPosition(
  anchor: Box,
  size: Size,
  viewport: Size,
  preferred: TooltipPlacement,
  gap: number,
  margin: number,
): TooltipPosition {
  let placement = preferred;
  let point = place(anchor, size, placement, gap);
  if (!fitsMainAxis(point, size, viewport, margin, placement)) {
    const flipped = place(anchor, size, OPPOSITE[placement], gap);
    if (fitsMainAxis(flipped, size, viewport, margin, OPPOSITE[placement]) || fits(flipped, size, viewport, margin)) {
      placement = OPPOSITE[placement];
      point = flipped;
    }
  }
  return {
    placement,
    left: Math.round(clamp(point.left, margin, viewport.width - margin - size.width)),
    top: Math.round(clamp(point.top, margin, viewport.height - margin - size.height)),
  };
}

export const TRANSFORM_ORIGIN: Record<TooltipPlacement, string> = {
  top: "50% 100%",
  bottom: "50% 0%",
  left: "100% 50%",
  right: "0% 50%",
};
