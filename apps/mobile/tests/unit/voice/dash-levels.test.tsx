import { render } from "@testing-library/react-native";

import LiveWaveform from "@/features/voice/components/live-waveform";
import { dashCapacity, dashRows, dashSpan } from "@/features/voice/utils/levels";

describe("dash waveform helpers", () => {
  it("fits an odd number of dashes so columns stay centred", () => {
    expect(dashCapacity(32, 2, 2)).toBe(7);
    expect(dashCapacity(30, 2, 2)).toBe(7);
    expect(dashCapacity(1, 2, 2)).toBe(1);
  });

  it("maps a level to an odd row count within capacity", () => {
    expect(dashRows(0, 7)).toBe(1);
    expect(dashRows(1, 7)).toBe(7);
    expect(dashRows(0.5, 7)).toBe(5);
    expect(dashRows(2, 7)).toBe(7);
  });

  it("measures the span of a dash stack", () => {
    expect(dashSpan(1, 2, 2)).toBe(2);
    expect(dashSpan(3, 2, 2)).toBe(10);
  });
});

describe("<LiveWaveform />", () => {
  it("draws one hidden column per level", async () => {
    const { toJSON } = await render(<LiveWaveform levels={[0.1, 0.5, 0.9]} />);
    const tree = toJSON();
    expect(tree).not.toBeNull();
    expect(Array.isArray(tree) ? null : tree?.children).toHaveLength(3);
  });
});
