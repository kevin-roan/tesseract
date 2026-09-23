import type { ReactElement, ReactNode } from "react";
import { render, screen } from "@testing-library/react-native";

import AppTabs from "@/components/app-tabs";
import WebAppTabs from "@/components/app-tabs.web";

jest.mock("expo-router/unstable-native-tabs", () => {
  const { Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
  const NativeTabs = ({ children }: { children: ReactNode }) => <View testID="native-tabs">{children}</View>;
  const Trigger = ({ name, children }: { name: string; children: ReactNode }) => (
    <View testID={`tab-${name}`}>{children}</View>
  );
  Trigger.Label = function Label({ children }: { children: ReactNode }) {
    return <Text>{children}</Text>;
  };
  Trigger.Icon = function TabIcon() {
    return null;
  };
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

jest.mock("expo-router/ui", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");
  const { cloneElement } = jest.requireActual<typeof import("react")>("react");
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Tabs: Pass,
    TabSlot: () => <View testID="tab-slot" />,
    TabList: Pass,
    TabTrigger: ({ name, children }: { name: string; children: ReactElement }) =>
      cloneElement(children as ReactElement<{ isFocused?: boolean }>, { isFocused: name === "agents" }),
  };
});

describe("AppTabs", () => {
  it("registers the native tabs", async () => {
    await render(<AppTabs />);
    for (const name of ["index", "agents", "projects", "profile"]) expect(screen.getByTestId(`tab-${name}`)).toBeOnTheScreen();
    expect(screen.getByText("Agents")).toBeOnTheScreen();
  });

  it("renders the web tab bar with the focused tab highlighted", async () => {
    await render(<WebAppTabs />);
    expect(screen.getByTestId("tab-slot")).toBeOnTheScreen();
    for (const label of ["Home", "Agents", "Tasks", "Projects", "Profile"]) expect(screen.getByText(label)).toBeOnTheScreen();
  });
});
