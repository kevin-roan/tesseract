import type { IconName } from "../../theme/icons";

export interface AnchorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MenuEntry {
  id?: string;
  label: string;
  onSelect(): void;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
}

export type MenuSection = readonly MenuEntry[];
export type MenuSections = readonly MenuSection[];

export type FloatingPlacement = "below" | "above";

export interface FloatingPosition {
  left: number;
  top: number;
  placement: FloatingPlacement;
}

export interface FloatingGeometry {
  anchor: AnchorRect;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  offset: number;
  margin: number;
}

export function nonEmptySections(sections: MenuSections): MenuSections {
  return sections.filter((section) => section.length > 0);
}

export function hasMenuEntries(sections: MenuSections): boolean {
  return sections.some((section) => section.length > 0);
}

export function pointAnchor(x: number, y: number): AnchorRect {
  return { x, y, width: 1, height: 1 };
}

export function rectAnchor(rect: Pick<DOMRect, "left" | "top" | "width" | "height">): AnchorRect {
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

export function centerAnchor(rect: Pick<DOMRect, "left" | "top" | "width" | "height">): AnchorRect {
  return pointAnchor(Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2));
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));

export function computeFloatingPosition({
  anchor,
  width,
  height,
  viewportWidth,
  viewportHeight,
  offset,
  margin,
}: FloatingGeometry): FloatingPosition {
  const below = anchor.y + anchor.height + offset;
  const above = anchor.y - offset - height;
  const fitsBelow = below + height <= viewportHeight - margin;
  const fitsAbove = above >= margin;
  const placement: FloatingPlacement = !fitsBelow && fitsAbove ? "above" : "below";
  const rawTop = placement === "below" ? below : above;
  return {
    left: clamp(anchor.x, margin, viewportWidth - margin - width),
    top: clamp(rawTop, margin, viewportHeight - margin - height),
    placement,
  };
}
