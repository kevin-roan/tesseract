import { StyleSheet, type StyleProp, type TextStyle } from "react-native";
import { fireEvent, render, screen, within } from "@testing-library/react-native";
import { QrCodeIcon } from "phosphor-react-native";

import EmptyState from "@/components/empty-state";
import LogView, { type LogViewLine } from "@/components/log-view";
import ActionButton from "@/components/action-button";
import ResourceCard from "@/components/resource-card";
import { cleanLogText } from "@/components/log-view/lines";
import StatusBadge from "@/components/status-badge";
import { createTheme } from "@/theme";

import { setStringAsync } from "../../../mocks/expo-clipboard";

const theme = createTheme({ scheme: "light", width: 390, height: 844 });
const colorOf = (node: { props: { style?: unknown } }) =>
  StyleSheet.flatten(node.props.style as StyleProp<TextStyle>)?.color;

const lines: LogViewLine[] = [
  { seq: 1, stream: "stdout", text: "\u001b[32m✔\u001b[39m compiled" },
  { seq: 2, stream: "stderr", text: "warning: wine not initialised" },
  { seq: 3, stream: "system", text: "process exited with code 0\n" },
];

describe("<LogView />", () => {
  it("renders each line without ANSI codes, tinted by stream", async () => {
    await render(<LogView lines={lines} />);

    expect(screen.getByText("✔ compiled")).toBeOnTheScreen();
    expect(colorOf(screen.getByText("warning: wine not initialised"))).toBe(theme.colors.danger);
    expect(colorOf(screen.getByText("process exited with code 0"))).toBe(theme.colors.textTertiary);
    expect(colorOf(screen.getByText("✔ compiled"))).toBe(theme.colors.text);
  });

  it("shows the empty label in both variants", async () => {
    await render(<LogView lines={[]} emptyLabel="Waiting for output…" />);
    expect(screen.getByText("Waiting for output…")).toBeOnTheScreen();

    await render(<LogView lines={[]} emptyLabel="Nothing yet" inline />);
    expect(screen.getByText("Nothing yet")).toBeOnTheScreen();
  });

  it("copies every line as plain text", async () => {
    await render(<LogView lines={lines} inline />);

    await fireEvent.press(screen.getByLabelText("Copy logs"));
    expect(setStringAsync).toHaveBeenCalledWith("✔ compiled\nwarning: wine not initialised\nprocess exited with code 0");
    expect(screen.getByLabelText("Logs copied")).toBeOnTheScreen();
  });

  it("hides the copy button while there is no output", async () => {
    await render(<LogView lines={[]} />);
    expect(screen.queryByLabelText("Copy logs")).toBeNull();
  });

  it("keeps only the latest lines in the inline variant", async () => {
    const many = Array.from({ length: 320 }, (_, index) => ({ seq: index, stream: "stdout" as const, text: `row ${index}` }));
    await render(<LogView lines={many} inline />);
    expect(screen.queryByText("row 0")).toBeNull();
    expect(screen.getByText("row 319")).toBeOnTheScreen();
  });

  it("offers a jump-to-latest button once the user scrolls up", async () => {
    await render(<LogView lines={lines} />);
    expect(screen.queryByLabelText("Jump to latest output")).toBeNull();

    await fireEvent.scroll(screen.getByLabelText("Log output").children[0] as never, {
      nativeEvent: {
        contentOffset: { x: 0, y: 0 },
        contentSize: { width: 300, height: 2000 },
        layoutMeasurement: { width: 300, height: 400 },
      },
    });

    expect(screen.getByLabelText("Jump to latest output")).toBeOnTheScreen();
  });
});

describe("cleanLogText", () => {
  it("keeps the last carriage-return frame of progress output", () => {
    expect(cleanLogText("10%\r50%\r100%\r\n")).toBe("100%");
    expect(cleanLogText("\u001b]0;title\u0007plain")).toBe("plain");
  });
});

describe("<StatusBadge />", () => {
  it("renders the label in the tone colour", async () => {
    await render(<StatusBadge label="Running" tone="success" />);
    expect(colorOf(screen.getByText("Running"))).toBe(theme.colors.success);
    expect(screen.getByLabelText("Running")).toBeOnTheScreen();
  });

  it("defaults to the neutral tone", async () => {
    await render(<StatusBadge label="Queued" />);
    expect(colorOf(screen.getByText("Queued"))).toBe(theme.colors.textSecondary);
  });
});

describe("<EmptyState />", () => {
  it("renders copy and fires the primary action", async () => {
    const onAction = jest.fn();
    await render(
      <EmptyState icon={QrCodeIcon} title="Pair a sandbox" message="Scan the code." actionLabel="Pair" onAction={onAction} />,
    );

    expect(screen.getByText("Pair a sandbox")).toBeOnTheScreen();
    expect(screen.getByText("Scan the code.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Pair" }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("shows a spinner instead of an action while loading", async () => {
    await render(<EmptyState loading title="Loading sandboxes…" actionLabel="Pair" />);
    expect(screen.getByText("Loading sandboxes…")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("<ResourceCard />", () => {
  it("keeps footer actions outside the card's own button so screen readers can reach both", async () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    await render(
      <ResourceCard
        title="Shell"
        subtitle="/workspace"
        onPress={onOpen}
        footer={<ActionButton label="Close session" onPress={onClose} />}
      />,
    );

    const card = screen.getByRole("button", { name: "Shell, /workspace" });
    expect(within(card).queryByLabelText("Close session")).toBeNull();

    await fireEvent.press(screen.getByRole("button", { name: "Close session" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();

    await fireEvent.press(card);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
