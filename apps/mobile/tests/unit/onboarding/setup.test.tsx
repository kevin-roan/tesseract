import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import * as Clipboard from "expo-clipboard";
import { PlusIcon } from "phosphor-react-native";

import ActionButton from "@/components/action-button";
import SchemeScope from "@/components/scheme-scope";
import ScreenHeader from "@/components/screen-header";
import SetupGuide from "@/features/onboarding/components/setup-guide";
import { SETUP_LABELS, SETUP_STEPS, commandLine, setupSummary, stepIndex, stepLabel } from "@/features/onboarding/utils/content";

const clipboard = Clipboard as typeof Clipboard & { __reset: () => void; setStringAsync: jest.Mock };

beforeEach(() => clipboard.__reset());

describe("setup utils", () => {
  it("formats step numbers and command lines", () => {
    expect(stepIndex(0)).toBe("01");
    expect(stepLabel(2)).toBe("Step 3");
    expect(commandLine("bun run sandbox up")).toBe("$ bun run sandbox up");
  });

  it("summarizes the steps", () => {
    const summary = setupSummary(SETUP_STEPS);
    expect(summary.stats.map((stat) => stat.value)).toEqual(["3", "2", SETUP_LABELS.tailnet]);
    expect(summary.segments.map((segment) => segment.active)).toEqual([false, false, true]);
  });
});

describe("<SetupGuide />", () => {
  it("renders the summary, every step and copies a command", async () => {
    jest.useFakeTimers();
    await render(
      <SchemeScope scheme="graphite">
        <SetupGuide summary={setupSummary(SETUP_STEPS)} steps={SETUP_STEPS} testID="guide" />
      </SchemeScope>,
    );
    expect(screen.getByTestId("setup-summary")).toBeOnTheScreen();
    for (const step of SETUP_STEPS) expect(screen.getByTestId(`setup-step-${step.id}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`setup-command-${SETUP_STEPS[2].id}`)).toBeNull();

    await fireEvent.press(screen.getAllByLabelText(SETUP_LABELS.copy)[0]);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith(SETUP_STEPS[0].command);
    expect(screen.getByLabelText(SETUP_LABELS.copied)).toBeOnTheScreen();

    await act(async () => {
      jest.runOnlyPendingTimers();
    });
    expect(screen.queryByLabelText(SETUP_LABELS.copied)).toBeNull();
    jest.useRealTimers();
  });
});

describe("graphite chrome", () => {
  it("outlines the secondary button and keeps the header controls", async () => {
    const onBack = jest.fn();
    await render(
      <SchemeScope scheme="graphite">
        <ScreenHeader
          title="Pair"
          onBack={onBack}
          actions={[{ id: "add", icon: PlusIcon, label: "Add", onPress: jest.fn() }]}
          size="large"
        />
        <ActionButton label="Later" variant="secondary" />
      </SchemeScope>,
    );
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(onBack).toHaveBeenCalled();
    expect(screen.getByLabelText("Add")).toBeOnTheScreen();
    const button = StyleSheet.flatten(screen.getByLabelText("Later").props.style);
    expect(button.backgroundColor).toBe("transparent");
    expect(button.borderWidth).toBe(StyleSheet.hairlineWidth);
  });
});
