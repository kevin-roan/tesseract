import { heartPose, lookAt, obeliskFace } from "@/features/settings/utils/egg";

describe("monolith egg", () => {
  it("looks toward the finger, clamped to the box", () => {
    expect(lookAt(50, 50, 100, 100)).toEqual({ x: 0, y: 0 });
    expect(lookAt(0, 100, 100, 100)).toEqual({ x: -1, y: 1 });
    expect(lookAt(-40, 500, 100, 100)).toEqual({ x: -1, y: 1 });
  });

  it("puts the face on the lit side, under the roof", () => {
    const face = obeliskFace({
      tip: { x: 100, y: 50 },
      leftShoulder: { x: 50, y: 80 },
      rightShoulder: { x: 150, y: 80 },
      ridgeBottom: 300,
      scale: 1,
    });
    expect(face).toEqual({ x: 75, y: 110, unit: 10 });
  });

  it("floats hearts up and fades them out", () => {
    expect(heartPose(0, 0, 10).opacity).toBe(0);
    expect(heartPose(0.35, 0, 10).y).toBeLessThan(0);
    expect(heartPose(1, 2, 10).opacity).toBeCloseTo(0);
  });
});
