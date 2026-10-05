import { dotPoint, SHAPE_SIDES } from "@/components/dot-shape/shapes";

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 3);
  expect(a.y).toBeCloseTo(b.y, 3);
};

describe("dotPoint", () => {
  it("puts the first dot at the top of the triangle and traces the circle two shapes later", () => {
    close(dotPoint(0, 0, 12, 0), { x: 0, y: -0.78 });
    for (let i = 0; i < 12; i += 1) {
      const p = dotPoint(2, i, 12, 0);
      expect(Math.hypot(p.x, p.y)).toBeCloseTo(0.82, 3);
    }
  });

  it("holds each shape before morphing and loops back to the triangle seamlessly", () => {
    close(dotPoint(0.3, 5, 12, 0), dotPoint(0, 5, 12, 0));
    close(dotPoint(1, 5, 12, 0), dotPoint(0.999999, 5, 12, 0));
    close(dotPoint(SHAPE_SIDES.length - 0.000001, 7, 12, 0.6), dotPoint(0, 7, 12, 0.6));
  });

  it("keeps scattered dots near the outline", () => {
    for (let i = 0; i < 40; i += 1) {
      const p = dotPoint(0.5, i, 40, 1);
      expect(Math.hypot(p.x, p.y)).toBeLessThan(1.1);
    }
  });
});
