import { fireEvent, render, screen } from "@testing-library/react-native";
import { TrayIcon } from "phosphor-react-native";

import DailyBars from "@/features/home/components/daily-bars";
import DrawerRow from "@/features/home/components/drawer-row";
import SegmentedPills from "@/components/segmented-pills";
import TokenSplit from "@/features/home/components/token-split";

const colors = { bar: "#444444", focus: "#ffffff", empty: "#222222", emptyStroke: "#333333", axis: "#777777" };

describe("<SegmentedPills />", () => {
  it("marks the chosen segment and reports presses", async () => {
    const onChange = jest.fn();
    await render(
      <SegmentedPills
        options={[
          { value: 7, label: "7D", accessibilityLabel: "Last 7 days" },
          { value: 30, label: "30D", accessibilityLabel: "Last 30 days" },
        ]}
        value={7}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("radio", { name: "Last 7 days" }).props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByRole("radio", { name: "Last 30 days" }));
    expect(onChange).toHaveBeenCalledWith(30);
  });
});

describe("<TokenSplit />", () => {
  it("describes every part's share", async () => {
    await render(
      <TokenSplit
        parts={[
          { id: "input", label: "Input", value: 750, fraction: 0.75 },
          { id: "output", label: "Output", value: 250, fraction: 0.25 },
        ]}
      />,
    );
    expect(screen.getByLabelText("Input 75%, Output 25%")).toBeTruthy();
    expect(screen.getByText("750")).toBeTruthy();
  });
});

describe("<DailyBars />", () => {
  it("labels the plot with its day count", async () => {
    const days = [
      { date: "2026-09-29", tokens: 0 },
      { date: "2026-09-30", tokens: 1200 },
      { date: "2026-10-01", tokens: 400 },
    ];
    await render(<DailyBars days={days} colors={colors} testID="usage-daily" />);
    expect(screen.getByLabelText("Daily tokens over the last 3 days")).toBeTruthy();
  });
});

describe("<DrawerRow />", () => {
  it("reads its count with the label and presses through", async () => {
    const onPress = jest.fn();
    await render(<DrawerRow icon={TrayIcon} label="Inbox" badge={3} index={0} onPress={onPress} testID="drawer-inbox" />);
    fireEvent.press(screen.getByRole("button", { name: "Inbox, 3" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("omits an empty count", async () => {
    await render(<DrawerRow icon={TrayIcon} label="Inbox" badge={0} index={0} onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Inbox" })).toBeTruthy();
  });
});
