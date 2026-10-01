import { clampRect, fitImage, imageToScreen, initialCrop, isFullImage, moveRect, resizeFromCorner, screenToImage } from "@/features/island/utils/crop";

const IMAGE = { width: 1000, height: 2000 };
const CONTAINER = { width: 300, height: 400 };

describe("fitImage", () => {
  it("letterboxes the image and centers it", () => {
    const fit = fitImage(IMAGE, CONTAINER);
    expect(fit.scale).toBeCloseTo(0.2);
    expect(fit).toMatchObject({ x: 50, y: 0, width: 200, height: 400 });
  });

  it("is inert for empty sizes", () => {
    expect(fitImage({ width: 0, height: 0 }, CONTAINER)).toEqual({ x: 0, y: 0, width: 0, height: 0, scale: 1 });
  });
});

describe("screen ↔ image", () => {
  const fit = fitImage(IMAGE, CONTAINER);

  it("round-trips a rectangle through both spaces", () => {
    const screen = { x: 70, y: 40, width: 100, height: 60 };
    const image = screenToImage(screen, fit);
    expect(image).toEqual({ x: 100, y: 200, width: 500, height: 300 });
    expect(imageToScreen(image, fit)).toEqual(screen);
  });
});

describe("clampRect", () => {
  const bounds = { x: 50, y: 0, width: 200, height: 400 };

  it("keeps the box inside the bounds", () => {
    expect(clampRect({ x: 0, y: -10, width: 100, height: 100 }, bounds)).toEqual({ x: 50, y: 0, width: 100, height: 100 });
    expect(clampRect({ x: 240, y: 390, width: 100, height: 100 }, bounds)).toEqual({ x: 150, y: 300, width: 100, height: 100 });
  });

  it("applies the minimum size and shrinks an oversized box", () => {
    expect(clampRect({ x: 60, y: 10, width: 5, height: 5 }, bounds, 48)).toMatchObject({ width: 48, height: 48 });
    expect(clampRect({ x: 0, y: 0, width: 900, height: 900 }, bounds)).toEqual(bounds);
  });

  it("starts with an inset box", () => {
    expect(initialCrop(bounds, 0.1)).toEqual({ x: 70, y: 40, width: 160, height: 320 });
  });
});

describe("moveRect and resizeFromCorner", () => {
  const bounds = { x: 0, y: 0, width: 300, height: 300 };
  const rect = { x: 100, y: 100, width: 100, height: 100 };

  it("moves without leaving the bounds", () => {
    expect(moveRect(rect, 20, -30, bounds)).toEqual({ x: 120, y: 70, width: 100, height: 100 });
    expect(moveRect(rect, 500, 500, bounds)).toEqual({ x: 200, y: 200, width: 100, height: 100 });
  });

  it("resizes from a corner while the opposite corner stays put", () => {
    expect(resizeFromCorner(rect, "topLeft", -20, -20, bounds, 10)).toEqual({ x: 80, y: 80, width: 120, height: 120 });
    expect(resizeFromCorner(rect, "bottomRight", 30, 10, bounds, 10)).toEqual({ x: 100, y: 100, width: 130, height: 110 });
    expect(resizeFromCorner(rect, "topRight", -10, 20, bounds, 10)).toEqual({ x: 100, y: 120, width: 90, height: 80 });
    expect(resizeFromCorner(rect, "bottomLeft", 10, -20, bounds, 10)).toEqual({ x: 110, y: 100, width: 90, height: 80 });
  });

  it("never goes below the minimum size or past the bounds", () => {
    expect(resizeFromCorner(rect, "bottomRight", -500, -500, bounds, 40)).toEqual({ x: 100, y: 100, width: 40, height: 40 });
    expect(resizeFromCorner(rect, "bottomRight", 500, 500, bounds, 40)).toEqual({ x: 100, y: 100, width: 200, height: 200 });
    expect(resizeFromCorner(rect, "topLeft", -500, -500, bounds, 40)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });

  it("detects a crop covering the whole image", () => {
    expect(isFullImage({ x: 0, y: 0, width: 1000, height: 2000 }, IMAGE)).toBe(true);
    expect(isFullImage({ x: 1, y: 0, width: 999, height: 2000 }, IMAGE)).toBe(false);
  });
});
