export const ICON_SOURCE = "apps/mobile/assets/images/icon.png";
export const ICON_CANVAS = 1024;
export const LINUX_SIZES = [16, 22, 24, 32, 48, 64, 128, 256, 512] as const;
export const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] as const;

export interface IconShape {
  square: number;
  radius: number;
}

export const ICON_SHAPES = {
  standard: { square: 896, radius: 224 },
  mac: { square: 824, radius: 185 },
} as const satisfies Record<string, IconShape>;

export function masterArgs(source: string, shape: IconShape, out: string): string[] {
  const last = shape.square - 1;
  return [
    source,
    "-resize",
    `${shape.square}x${shape.square}!`,
    "-alpha",
    "set",
    "(",
    "-size",
    `${shape.square}x${shape.square}`,
    "xc:none",
    "-fill",
    "white",
    "-draw",
    `roundrectangle 0,0 ${last},${last} ${shape.radius},${shape.radius}`,
    ")",
    "-compose",
    "DstIn",
    "-composite",
    "-compose",
    "Over",
    "-background",
    "none",
    "-gravity",
    "center",
    "-extent",
    `${ICON_CANVAS}x${ICON_CANVAS}`,
    "-strip",
    out,
  ];
}

export function resizeArgs(master: string, size: number, out: string): string[] {
  return [master, "-filter", "Lanczos", "-resize", `${size}x${size}`, "-strip", out];
}

export function icoArgs(master: string, out: string): string[] {
  return [master, "-filter", "Lanczos", "-define", `icon:auto-resize=${ICO_SIZES.join(",")}`, out];
}
