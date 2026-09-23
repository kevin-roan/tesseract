import { Text } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@theone/client";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import RootLayout from "@/app/_layout";
import TabsLayout from "@/app/(tabs)/_layout";
import SandboxEventsBridge from "@/features/sandbox/components/sandbox-events-bridge";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";
import { bindQueryManagers } from "@/lib/query-client";
import AppProviders from "@/providers/app-providers";
import QueryProvider from "@/providers/query-provider";

const mockEvents = jest.fn();

jest.mock("@/lib/query-client", () => ({
  ...jest.requireActual("@/lib/query-client"),
  bindQueryManagers: jest.fn(),
}));
jest.mock("@/features/sandbox/hooks/use-sandbox-events", () => ({ useSandboxEvents: () => mockEvents() }));
jest.mock("expo-font", () => ({ useFonts: jest.fn() }));
jest.mock("expo-splash-screen", () => ({ preventAutoHideAsync: jest.fn(), hideAsync: jest.fn() }));
jest.mock("expo-router", () => {
  const { Text: MockText, View } = jest.requireActual<typeof import("react-native")>("react-native");
  const Stack = ({ children }: { children: React.ReactNode }) => <View testID="stack">{children}</View>;
  Stack.Screen = function Screen({ name }: { name: string }) {
    return <MockText>{name}</MockText>;
  };
  return { Stack };
});
jest.mock("@/components/app-tabs", () => {
  const { Text: MockText } = jest.requireActual<typeof import("react-native")>("react-native");
  return function MockAppTabs() {
    return <MockText>tabs</MockText>;
  };
});

const mockUseFonts = useFonts as jest.Mock;

function RetryProbe() {
  const retry = useQueryClient().getDefaultOptions().queries?.retry as (count: number, error: unknown) => boolean;
  return <Text>{`${retry(0, new Error("offline"))}/${retry(0, new ApiError(401, "unauthorized", "no"))}`}</Text>;
}

beforeEach(() => {
  mockEvents.mockClear();
  (bindQueryManagers as jest.Mock).mockClear();
  (SplashScreen.hideAsync as jest.Mock).mockClear();
});

describe("QueryProvider", () => {
  it("binds the managers once and retries only retryable errors", async () => {
    const { rerender } = await render(
      <QueryProvider>
        <RetryProbe />
      </QueryProvider>,
    );
    expect(screen.getByText("true/false")).toBeOnTheScreen();
    await rerender(
      <QueryProvider>
        <RetryProbe />
      </QueryProvider>,
    );
    expect(bindQueryManagers).toHaveBeenCalledTimes(1);
  });
});

describe("SandboxEventsBridge", () => {
  it("hydrates the sandbox store and opens the events socket", async () => {
    const hydrate = jest.fn(async () => undefined);
    const original = useSandboxStore.getState().hydrate;
    useSandboxStore.setState({ hydrate });

    await render(
      <AppProviders>
        <Text>child</Text>
      </AppProviders>,
    );
    expect(screen.getByText("child")).toBeOnTheScreen();
    expect(hydrate).toHaveBeenCalledTimes(1);
    expect(mockEvents).toHaveBeenCalled();

    await render(<SandboxEventsBridge />);
    expect(hydrate).toHaveBeenCalledTimes(2);
    await act(async () => useSandboxStore.setState({ hydrate: original }));
  });
});

describe("RootLayout", () => {
  const original = useSandboxStore.getState().hydrate;
  beforeEach(() => useSandboxStore.setState({ hydrate: jest.fn(async () => undefined) }));
  afterAll(() => useSandboxStore.setState({ hydrate: original }));

  it("renders nothing until fonts settle", async () => {
    mockUseFonts.mockReturnValue([false, null]);
    await render(<RootLayout />);
    expect(screen.queryByTestId("stack")).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  it.each([
    ["loaded", [true, null]],
    ["failed", [false, new Error("font")]],
  ])("registers every sandbox route once fonts are %s", async (_state, fonts) => {
    mockUseFonts.mockReturnValue(fonts);
    await render(<RootLayout />);
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
    for (const route of ["(tabs)", "pair", "sandbox/display", "sandbox/terminal/[id]", "sandbox/projects/new", "sandbox/agent/[id]"]) {
      expect(screen.getByText(route)).toBeOnTheScreen();
    }
  });
});

describe("TabsLayout", () => {
  it("renders the app tabs", async () => {
    await render(<TabsLayout />);
    expect(screen.getByText("tabs")).toBeOnTheScreen();
  });
});
