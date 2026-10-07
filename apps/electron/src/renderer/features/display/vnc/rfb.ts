import type { RfbChannel, RfbFactory, RfbLike, RfbOptions } from "./rfb-types";

export const createNoVncRfb: RfbFactory = async (target: HTMLElement, open: () => string | RfbChannel, options: RfbOptions) => {
  const { default: RFB } = await import("@novnc/novnc");
  return new RFB(target, open(), options) as unknown as RfbLike;
};
