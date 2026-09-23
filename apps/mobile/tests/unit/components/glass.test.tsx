import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { GlassButton, GlassPill, GlassSurface } from "@/components/glass";

let mockSupported = false;

jest.mock("@callstack/liquid-glass", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return {
    LiquidGlassView: (props: object) => <View testID="liquid" {...props} />,
    get isLiquidGlassSupported() {
      return mockSupported;
    },
  };
});
jest.mock("expo-blur", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  return { BlurView: (props: object) => <View testID="blur" {...props} /> };
});

describe.each([
  ["blur fallback", false, "blur"],
  ["liquid glass", true, "liquid"],
])("glass (%s)", (_name, supported, testID) => {
  it("renders a surface, a pill and a pressable button", async () => {
    mockSupported = supported;
    const onPress = jest.fn();

    await render(
      <>
        <GlassSurface effect="clear" tintOnFallback="#123">
          <Text>surface</Text>
        </GlassSurface>
        <GlassPill>
          <Text>pill</Text>
        </GlassPill>
        <GlassButton accessibilityLabel="Glass action" onPress={onPress}>
          <Text>button</Text>
        </GlassButton>
        <GlassButton accessibilityLabel="Disabled action" disabled>
          <Text>off</Text>
        </GlassButton>
      </>,
    );

    expect(screen.getByText("surface")).toBeOnTheScreen();
    expect(screen.getByText("pill")).toBeOnTheScreen();
    expect(screen.getAllByTestId(testID).length).toBeGreaterThanOrEqual(3);
    await fireEvent.press(screen.getByLabelText("Glass action"));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByLabelText("Disabled action").props.accessibilityState).toEqual({ disabled: true });
  });
});
