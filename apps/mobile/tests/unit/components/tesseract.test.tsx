import { render, screen } from "@testing-library/react-native";

import Tesseract from "@/components/tesseract";
import {
  TESSERACT_EDGES,
  TESSERACT_LOOP,
  TESSERACT_VERTICES,
  starField,
  tesseractPoints,
  traceEdges,
  traceStars,
} from "@/components/tesseract/geometry";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

function recorder() {
  const calls: string[] = [];
  return {
    calls,
    moveTo: (x: number, y: number) => calls.push(`M${x},${y}`),
    lineTo: (x: number, y: number) => calls.push(`L${x},${y}`),
  };
}

describe("<Tesseract />", () => {
  it("draws a hidden canvas", async () => {
    await render(<Tesseract size={200} testID="tesseract" />);
    expect(screen.getByTestId("tesseract", { includeHiddenElements: true })).toBeTruthy();
  });
});

describe("tesseract geometry", () => {
  it("has 16 corners and 32 edges, 12 per cube and 8 struts", () => {
    expect(TESSERACT_VERTICES).toHaveLength(16);
    expect(TESSERACT_EDGES.near).toHaveLength(12);
    expect(TESSERACT_EDGES.far).toHaveLength(12);
    expect(TESSERACT_EDGES.struts).toHaveLength(8);
  });

  it("keeps every corner inside the canvas through a whole loop", () => {
    for (let t = 0; t < TESSERACT_LOOP; t += 0.25) {
      for (const { x, y } of tesseractPoints(t, 200)) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(200);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(200);
      }
    }
  });

  it("loops seamlessly", () => {
    const start = tesseractPoints(3, 200);
    const end = tesseractPoints(3 + TESSERACT_LOOP, 200);
    start.forEach((point, index) => {
      expect(end[index]!.x).toBeCloseTo(point.x, 6);
      expect(end[index]!.y).toBeCloseTo(point.y, 6);
    });
  });

  it("traces one segment per edge and per star", () => {
    const edges = recorder();
    traceEdges(edges, tesseractPoints(0, 200), TESSERACT_EDGES.near);
    expect(edges.calls).toHaveLength(24);

    const stars = recorder();
    traceStars(stars, starField(10), 1, 200);
    expect(stars.calls).toHaveLength(20);
  });
});
