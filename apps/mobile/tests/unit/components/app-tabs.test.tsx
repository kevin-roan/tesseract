import type { ReactElement, ReactNode } from "react";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AppTabs from "@/components/app-tabs";

jest.mock("expo-router/ui", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { cloneElement } = jest.requireActual<typeof import("react")>("react");
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Tabs: Pass,
    TabSlot: () => <View testID="tab-slot" />,
    TabList: Pass,
    TabTrigger: ({ name, children }: { name: string; children?: ReactElement }) =>
      children ? cloneElement(children as ReactElement<{ isFocused?: boolean }>, { isFocused: name === "agents" }) : null,
  };
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

describe("AppTabs", () => {
  it("renders the floating tab bar with the focused tab selected", async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppTabs />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId("tab-slot")).toBeOnTheScreen();
    for (const label of ["Home", "Agents", "Tasks", "Projects", "Profile"]) expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.getByRole("tab", { selected: true })).toHaveTextContent("Agents");
  });
});
