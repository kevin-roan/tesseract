import { render, screen } from "@testing-library/react-native";

import GlassTesseract from "@/components/glass-tesseract";
import {
  GLASS_FACES,
  GLASS_TESSERACT,
  INNER_FACES,
  OUTER_FACES,
  glassFrame,
  moteField,
  traceFaces,
  traceMotes,
} from "@/components/glass-tesseract/geometry";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

function recorder() {
  const calls: string[] = [];
  return {
    calls,
    moveTo: () => calls.push("M"),
    lineTo: () => calls.push("L"),
    close: () => calls.push("Z"),
    addCircle: () => calls.push("O"),
  };
}

const poses = (() => {
  const list = [];
  for (let t = 0; t < GLASS_TESSERACT.loop; t += 0.5) {
    for (const yaw of [0, 0.7, 2.1]) {
      for (const pitch of [-GLASS_TESSERACT.pitch.max, GLASS_TESSERACT.pitch.rest, GLASS_TESSERACT.pitch.max]) {
        for (const flare of [0, 1]) list.push({ t, yaw, pitch, flare });
      }
    }
  }
  return list;
})();

describe("<GlassTesseract />", () => {
  it("draws a hidden canvas", async () => {
    await render(<GlassTesseract size={200} testID="glass" />);
    expect(screen.getByTestId("glass", { includeHiddenElements: true })).toBeTruthy();
  });
});

describe("glass tesseract geometry", () => {
  it("has six faces per cube, each a quad of one cube's corners", () => {
    expect(GLASS_FACES).toHaveLength(12);
    for (const index of OUTER_FACES) expect(GLASS_FACES[index]!.every((corner) => corner >= 8)).toBe(true);
    for (const index of INNER_FACES) expect(GLASS_FACES[index]!.every((corner) => corner < 8)).toBe(true);
  });

  it("keeps every corner inside its square in every pose", () => {
    for (const pose of poses) {
      for (const { x, y } of glassFrame(pose, 200).points) {
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(200);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(200);
      }
    }
  });

  it("shows between one and three faces of the outer cube", () => {
    for (const pose of poses) {
      const shown = OUTER_FACES.filter((index) => glassFrame(pose, 200).faces[index]!.front).length;
      expect(shown).toBeGreaterThanOrEqual(1);
      expect(shown).toBeLessThanOrEqual(3);
    }
  });

  it("loops seamlessly", () => {
    const start = glassFrame({ t: 3, yaw: 0, pitch: 0.4, flare: 0 }, 200);
    const end = glassFrame({ t: 3 + GLASS_TESSERACT.loop, yaw: 0, pitch: 0.4, flare: 0 }, 200);
    start.points.forEach((point, index) => {
      expect(end.points[index]!.x).toBeCloseTo(point.x, 6);
      expect(end.points[index]!.y).toBeCloseTo(point.y, 6);
    });
  });

  it("traces front and back faces separately, and every mote", () => {
    const frame = glassFrame({ t: 0, yaw: 0.3, pitch: 0.4, flare: 0 }, 200);
    const front = recorder();
    const back = recorder();
    traceFaces(front, frame, OUTER_FACES, true);
    traceFaces(back, frame, OUTER_FACES, false);
    expect(front.calls.length + back.calls.length).toBe(6 * 5);

    const dust = recorder();
    traceMotes(dust, moteField(9), 1, 200, 260);
    expect(dust.calls).toHaveLength(9);
  });
});
