import { fireEvent, render, screen } from "@testing-library/react-native";
import { FolderIcon } from "phosphor-react-native";
import { Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import BottomSheet from "@/components/bottom-sheet";
import Chip from "@/components/chip";
import DataCard from "@/components/data-card";
import { ListGroup, ListRow } from "@/components/list-group";
import SchemeScope from "@/components/scheme-scope";

describe("<ListRow /> press and selection", () => {
  it("presses, announces selection and badges a count in graphite", async () => {
    const onPress = jest.fn();
    await render(
      <SchemeScope scheme="graphite">
        <ListGroup title="Files">
          <ListRow label="src" icon={FolderIcon} badge={2} selected onPress={onPress} testID="row" />
          <ListRow label="docs" icon={FolderIcon} />
        </ListGroup>
      </SchemeScope>,
    );
    const row = screen.getByLabelText("src, 2");
    expect(row.props.accessibilityState).toEqual(expect.objectContaining({ selected: true }));
    await fireEvent(row, "pressIn");
    await fireEvent(row, "pressOut");
    await fireEvent.press(row);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText("2")).toBeOnTheScreen();
    expect(screen.getByTestId("row")).toBeOnTheScreen();
  });

  it("keeps the bare icon look in classic", async () => {
    await render(<ListRow label="Settings" icon={FolderIcon} chevron onPress={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Settings" })).toBeOnTheScreen();
  });
});

describe("<Chip /> selection", () => {
  it("switches between selected and idle and stays pressable", async () => {
    const onPress = jest.fn();
    const { rerender } = await render(<Chip label="All" onPress={onPress} />);
    expect(screen.getByRole("button", { name: "All" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: false }),
    );
    await rerender(<Chip label="All" selected onPress={onPress} />);
    await fireEvent.press(screen.getByRole("button", { name: "All" }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "All" }).props.accessibilityState).toEqual(
      expect.objectContaining({ selected: true }),
    );
  });

  it("renders the ghost picker variant", async () => {
    await render(<Chip label="Model" variant="ghost" />);
    expect(screen.getByRole("button", { name: "Model" })).toBeOnTheScreen();
  });
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe("sheets", () => {
  it("opens a bottom sheet and closes it from the header", async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomSheet visible title="Attach" onClose={onClose} testID="sheet">
          <Text>Body</Text>
        </BottomSheet>
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Body")).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByLabelText("Close")[1]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("<DataCard /> entrance", () => {
  it("puts the testID on the animated wrapper when indexed", async () => {
    await render(
      <DataCard title="Usage" index={1} testID="usage">
        <Text>Chart</Text>
      </DataCard>,
    );
    expect(screen.getByTestId("usage")).toBeOnTheScreen();
    expect(screen.getByText("Usage")).toBeOnTheScreen();
  });
});
