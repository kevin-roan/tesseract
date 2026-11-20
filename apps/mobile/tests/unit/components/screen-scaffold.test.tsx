import { render, screen } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";
import { SafeAreaProvider, type Edge } from "react-native-safe-area-context";

import ModalSafeArea from "@/components/modal-safe-area";
import ScreenScaffold from "@/components/screen-scaffold";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { NativeTabBarContext, TabBarInsetContext, useNativeTabBar } from "@/hooks/use-tab-bar-inset";

jest.mock("@/hooks/use-keyboard-height", () => ({ useKeyboardHeight: jest.fn(() => 0) }));

const keyboard = jest.mocked(useKeyboardHeight);

const HOME_INDICATOR = 34;
const NATIVE_BAR_BOTTOM = 83;
const FLOATING_BAR = 60;
const KEYBOARD = 336;

const metrics = (bottom: number) => ({
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom, left: 0, right: 0 },
});

type HostProps = { native?: boolean; floating?: number; bottom: number; children: ReactNode };

const Host = ({ native = false, floating = 0, bottom, children }: HostProps) => (
  <SafeAreaProvider initialMetrics={metrics(bottom)}>
    <TabBarInsetContext.Provider value={floating}>
      <NativeTabBarContext.Provider value={native}>{children}</NativeTabBarContext.Provider>
    </TabBarInsetContext.Provider>
  </SafeAreaProvider>
);

const edgesOf = () => screen.getByTestId("scaffold-safe-area").props.edges as Record<Edge, string>;
const contentPadding = () =>
  StyleSheet.flatten(screen.getByTestId("scaffold-scroll").props.contentContainerStyle).paddingBottom as number;
const framePadding = () => StyleSheet.flatten(screen.getByTestId("scaffold-frame").props.style).paddingBottom as number;

const renderScroll = async (host: Omit<HostProps, "children">, edges?: readonly Edge[]) => {
  await render(
    <Host {...host}>
      <ScreenScaffold testID="scaffold" edges={edges}>
        <Text>Body</Text>
      </ScreenScaffold>
    </Host>,
  );
};

const renderComposer = async (host: Omit<HostProps, "children">) => {
  await render(
    <Host {...host}>
      <ScreenScaffold testID="scaffold" scroll={false} avoidKeyboard footer={<Text>Composer</Text>}>
        <Text>Body</Text>
      </ScreenScaffold>
    </Host>,
  );
};

describe("<ScreenScaffold /> insets", () => {
  afterEach(() => keyboard.mockReturnValue(0));

  it("pads every safe edge and only the section gap outside the tabs", async () => {
    await renderScroll({ bottom: HOME_INDICATOR });
    const base = contentPadding();

    expect(edgesOf()).toEqual({ top: "additive", right: "additive", bottom: "additive", left: "additive" });
    expect(base).toBeGreaterThan(0);

    await renderScroll({ bottom: HOME_INDICATOR, floating: FLOATING_BAR });
    expect(edgesOf().bottom).toBe("additive");
    expect(contentPadding()).toBe(base + FLOATING_BAR);
  });

  it("scrolls under the native bar and reserves its inset inside the content", async () => {
    await renderScroll({ bottom: HOME_INDICATOR });
    const base = contentPadding();

    await renderScroll({ bottom: NATIVE_BAR_BOTTOM, native: true });
    expect(edgesOf()).toEqual({ top: "additive", right: "additive", bottom: "off", left: "additive" });
    expect(contentPadding()).toBe(base + NATIVE_BAR_BOTTOM);
    expect(framePadding()).toBe(0);
  });

  it("keeps a caller's edges minus the bottom under the native bar", async () => {
    await renderScroll({ bottom: NATIVE_BAR_BOTTOM, native: true }, ["left", "right", "bottom"]);
    expect(edgesOf()).toEqual({ top: "off", right: "additive", bottom: "off", left: "additive" });
  });

  it("drops the bar inset and lifts by the whole keyboard when it covers the native bar", async () => {
    keyboard.mockReturnValue(KEYBOARD);
    await renderScroll({ bottom: HOME_INDICATOR });
    const base = contentPadding();

    await renderScroll({ bottom: NATIVE_BAR_BOTTOM, native: true });
    expect(contentPadding()).toBe(base);
    expect(framePadding()).toBe(KEYBOARD);
  });

  it("docks a footer above the native bar through the padded bottom edge", async () => {
    await renderComposer({ bottom: HOME_INDICATOR });
    const footer = StyleSheet.flatten(screen.getByTestId("scaffold-footer").props.style).paddingBottom;

    await renderComposer({ bottom: NATIVE_BAR_BOTTOM, native: true });
    expect(edgesOf().bottom).toBe("additive");
    expect(StyleSheet.flatten(screen.getByTestId("scaffold-footer").props.style).paddingBottom).toBe(footer);
    expect(framePadding()).toBe(0);
  });

  it("tops the padded native bar up to the keyboard height", async () => {
    keyboard.mockReturnValue(KEYBOARD);
    await renderComposer({ bottom: NATIVE_BAR_BOTTOM, native: true });
    expect(framePadding()).toBe(KEYBOARD - NATIVE_BAR_BOTTOM);
  });
});

describe("<ModalSafeArea />", () => {
  const Probe = () => <Text testID="probe">{String(useNativeTabBar())}</Text>;

  it("passes through outside the native bar", async () => {
    await render(
      <Host bottom={HOME_INDICATOR}>
        <ModalSafeArea>
          <Probe />
        </ModalSafeArea>
      </Host>,
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("false");
  });

  it("leaves the native bar behind for modal content", async () => {
    await render(
      <Host bottom={NATIVE_BAR_BOTTOM} native>
        <Probe />
        <ModalSafeArea>
          <Probe />
        </ModalSafeArea>
      </Host>,
    );
    expect(screen.getAllByTestId("probe").map((node) => node.props.children)).toEqual(["true", "false"]);
  });
});
