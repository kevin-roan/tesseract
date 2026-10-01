import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GlobeIcon, PlusIcon } from "phosphor-react-native";

import GlassSheet from "@/components/glass-sheet";
import GlassToolbar from "@/components/glass-toolbar";

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe("GlassToolbar", () => {
  it("renders the title, subtitle, back and actions with their selected state", async () => {
    const onBack = jest.fn();
    const onAdd = jest.fn();
    await render(
      <GlassToolbar
        title="Display"
        subtitle=":1"
        accessory={<Text>Connected</Text>}
        onBack={onBack}
        actions={[
          { id: "add", icon: PlusIcon, label: "Add", onPress: onAdd },
          { id: "web", icon: GlobeIcon, label: "Web", onPress: jest.fn(), selected: true },
        ]}
      />,
    );
    expect(screen.getByText("Display")).toBeOnTheScreen();
    expect(screen.getByText(":1")).toBeOnTheScreen();
    expect(screen.getByText("Connected")).toBeOnTheScreen();
    expect(screen.getByLabelText("Web")).toBeSelected();

    await fireEvent.press(screen.getByLabelText("Go back"));
    await fireEvent.press(screen.getByLabelText("Add"));
    expect(onBack).toHaveBeenCalled();
    expect(onAdd).toHaveBeenCalled();
  });
});

describe("GlassSheet", () => {
  it("shows its content while visible and closes from the backdrop", async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <GlassSheet visible onClose={onClose} title="Sandbox browser" subtitle="Current page">
          <Text>Body</Text>
        </GlassSheet>
      </SafeAreaProvider>,
    );
    expect(screen.getByText("Sandbox browser")).toBeOnTheScreen();
    expect(screen.getByText("Body")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });
});
