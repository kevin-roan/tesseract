import { fireEvent, render, screen } from "@testing-library/react-native";

import ClaudeMark from "@/components/claude-mark";
import { starburstRays } from "@/components/claude-mark/utils/rays";
import OptionSheet from "@/components/option-sheet";
import ComposerBanner from "@/features/chat/components/composer-banner";
import ComposerBar from "@/features/chat/components/composer-bar";
import ModePill from "@/features/chat/components/mode-pill";
import { AGENT_MODE_OPTIONS, AGENT_MODE_SHEET } from "@/features/chat/utils/modes";
import { homeStatus } from "@/features/home/utils/status";

describe("starburstRays", () => {
  it("radiates twelve strokes that stay inside the box", () => {
    const rays = starburstRays(40, 3);
    expect(rays).toHaveLength(12);
    for (const ray of rays) {
      for (const value of [ray.x1, ray.y1, ray.x2, ray.y2]) {
        expect(value).toBeGreaterThanOrEqual(1.5);
        expect(value).toBeLessThanOrEqual(38.5);
      }
    }
    expect(rays[0].x2).toBeCloseTo(20);
    expect(rays[0].y2).toBeCloseTo(1.5);
  });

  it("renders the mark", async () => {
    await render(<ClaudeMark testID="mark" />);
    expect(screen.getByTestId("mark", { includeHiddenElements: true })).toBeTruthy();
  });
});

describe("homeStatus", () => {
  const openInbox = jest.fn();
  const build = { title: "Building APK", message: "Compile", progress: 0.5, view: jest.fn() };

  it("puts an unreachable sandbox first", () => {
    const view = jest.fn();
    expect(homeStatus({ offline: { view }, attention: "1 request needs you", openInbox, build })).toMatchObject({
      id: "offline",
      title: "Sandbox unreachable",
      onAction: view,
    });
  });

  it("prefers the inbox, then a build, else nothing", () => {
    expect(homeStatus({ attention: "1 request needs you", openInbox, build })).toMatchObject({
      id: "inbox",
      message: "1 request needs you",
      onAction: openInbox,
    });
    expect(homeStatus({ attention: null, openInbox, build })).toMatchObject({ id: "build", progress: 0.5, onAction: build.view });
    expect(homeStatus({ attention: null, openInbox, build: null })).toBeNull();
  });
});

describe("<OptionSheet />", () => {
  it("shows the Claude-style picker with badges, a check and a footnote", async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    await render(
      <OptionSheet
        visible
        title={AGENT_MODE_SHEET.title}
        footnote={AGENT_MODE_SHEET.footnote}
        options={AGENT_MODE_OPTIONS}
        selectedId="plan"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Select mode")).toBeOnTheScreen();
    expect(screen.getByText("Default")).toBeOnTheScreen();
    expect(screen.getByText(AGENT_MODE_SHEET.footnote)).toBeOnTheScreen();
    expect(screen.getByLabelText("Plan").props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByLabelText("Edit"));
    expect(onSelect).toHaveBeenCalledWith("acceptEdits");
    await fireEvent.press(screen.getAllByLabelText("Close")[1]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe("<ComposerBanner /> and <ModePill />", () => {
  it("shows the status with an optional progress bar and action", async () => {
    const onAction = jest.fn();
    await render(<ComposerBanner title="Claude is waiting" message="1 request" actionLabel="Open inbox" onAction={onAction} />);
    expect(screen.queryByLabelText("Claude is waiting")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Open inbox"));
    expect(onAction).toHaveBeenCalled();

    await render(<ComposerBanner title="Building" progress={0.3} actionLabel="View" onAction={onAction} />);
    expect(screen.getByLabelText("Building").props.accessibilityValue).toMatchObject({ now: 30 });
  });

  it("presses the mode pill", async () => {
    const onPress = jest.fn();
    await render(<ModePill label="Auto" detail="Full access" onPress={onPress} />);
    expect(screen.getByText(/Full access/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Auto"));
    expect(onPress).toHaveBeenCalled();
  });
});

describe("<ComposerBar /> send row", () => {
  it("offers the mic beside send once there is a draft", async () => {
    const onMic = jest.fn();
    const base = { value: "hi", onChangeText: jest.fn(), placeholder: "Message", onPrimary: jest.fn(), onMic };
    await render(<ComposerBar {...base} primary="send" banner={<ModePill label="Banner" onPress={jest.fn()} />} />);
    expect(screen.getByLabelText("Banner")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Record voice message"));
    expect(onMic).toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Send"));
    expect(base.onPrimary).toHaveBeenCalled();
  });
});
