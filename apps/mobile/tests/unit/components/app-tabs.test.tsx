import type { ReactElement, ReactNode } from "react";
import { Platform } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";

import AppTabs from "@/components/app-tabs";

const mockInbox = { unreadCount: 2 };

jest.mock("expo-glass-effect", () => ({
  isLiquidGlassAvailable: jest.fn(() => false),
  isGlassEffectAPIAvailable: jest.fn(() => false),
  GlassView: () => null,
}));

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

jest.mock("expo-router/unstable-native-tabs", () => {
  const { Text, View } = jest.requireActual<typeof import("react-native")>("react-native");
  const NativeTabs = ({ children, ...props }: { children?: ReactNode; minimizeBehavior?: string }) => (
    <View testID="native-tabs" accessibilityHint={props.minimizeBehavior}>
      {children}
    </View>
  );
  const Trigger = ({
    name,
    children,
    disableAutomaticContentInsets,
  }: {
    name: string;
    children?: ReactNode;
    disableAutomaticContentInsets?: boolean;
  }) => (
    <View testID={`trigger-${name}`} accessibilityHint={disableAutomaticContentInsets ? "manual-insets" : undefined}>
      {children}
    </View>
  );
  Trigger.Icon = function Icon({ sf }: { sf: { default: string; selected: string } }) {
    return <View testID={`icon-${sf.default}`} />;
  };
  Trigger.Label = function Label({ children }: { children?: string }) {
    return <Text>{children}</Text>;
  };
  Trigger.Badge = function Badge({ children }: { children?: string }) {
    return <Text testID="badge">{children}</Text>;
  };
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});

jest.mock("@/features/inbox/hooks/use-inbox", () => ({
  useInbox: () => ({ data: mockInbox }),
}));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const labels = ["Home", "Agents", "Tasks", "Projects", "Profile"];

const setGlass = (available: boolean) => {
  jest.mocked(isLiquidGlassAvailable).mockReturnValue(available);
  jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(available);
};

const renderTabs = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <AppTabs />
    </SafeAreaProvider>,
  );

describe("AppTabs", () => {
  beforeEach(() => {
    mockInbox.unreadCount = 2;
  });

  describe("floating tab bar", () => {
    beforeEach(() => {
      setGlass(false);
    });

    it("renders a labelled tab bar with the focused tab selected", async () => {
      await renderTabs();
      expect(screen.queryByTestId("native-tabs")).toBeNull();
      expect(screen.getByTestId("tab-slot")).toBeOnTheScreen();
      for (const label of labels) {
        expect(screen.getByRole("tab", { name: label })).toBeOnTheScreen();
        expect(screen.getByText(label)).toBeOnTheScreen();
      }
      expect(screen.getByRole("tab", { selected: true })).toHaveAccessibleName("Agents");
      expect(screen.getByRole("button", { name: "Inbox, unread" })).toBeOnTheScreen();
    });
  });

  describe("native tabs", () => {
    beforeEach(() => {
      setGlass(true);
    });

    it("runs on iOS in this jest setup", () => {
      expect(Platform.OS).toBe("ios");
    });

    it("renders five system triggers with labels and manual insets", async () => {
      await renderTabs();
      expect(screen.getByTestId("native-tabs")).toHaveProp("accessibilityHint", "never");
      expect(screen.queryByTestId("tab-slot")).toBeNull();
      expect(screen.queryByRole("button", { name: /Inbox/ })).toBeNull();
      for (const name of ["index", "agents", "tasks", "projects", "profile"]) {
        expect(screen.getByTestId(`trigger-${name}`)).toHaveProp("accessibilityHint", "manual-insets");
      }
      for (const label of labels) expect(screen.getByText(label)).toBeOnTheScreen();
      expect(screen.getByTestId("icon-house")).toBeOnTheScreen();
    });

    it("badges the Home trigger with the unread count", async () => {
      await renderTabs();
      expect(screen.getByTestId("trigger-index")).toContainElement(screen.getByTestId("badge"));
      expect(screen.getByTestId("badge")).toHaveTextContent("2");
    });

    it("shows no badge when the inbox is read", async () => {
      mockInbox.unreadCount = 0;
      await renderTabs();
      expect(screen.queryByTestId("badge")).toBeNull();
    });
  });
});
