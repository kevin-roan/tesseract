import { fireEvent, render, screen } from "@testing-library/react-native";
import { sampleStatus } from "@theone/protocol/fixtures";

import ResourceHistory from "@/features/sandbox/components/resource-history";
import { useResourceHistoryStore } from "@/features/sandbox/store/resource-history-store";
import { useSandboxStore } from "@/features/sandbox/store/sandbox-store";

import { TEST_SANDBOX } from "../helpers";

jest.mock("@/hooks/use-screen-active", () => ({ useScreenActive: () => false }));

beforeEach(() => {
  useSandboxStore.setState({ sandboxes: [TEST_SANDBOX], activeId: TEST_SANDBOX.id });
  useResourceHistoryStore.setState({ samples: {} });
});

describe("ResourceHistory", () => {
  it("shows the collecting state before any sample arrives", async () => {
    await render(<ResourceHistory />);
    expect(screen.getByText("Resource history")).toBeOnTheScreen();
    expect(screen.getByLabelText("CPU load, —")).toBeOnTheScreen();
  });

  it("lists current readings and toggles series", async () => {
    const now = Date.now();
    useResourceHistoryStore.getState().record(TEST_SANDBOX.id, sampleStatus, now - 10_000);
    useResourceHistoryStore.getState().record(TEST_SANDBOX.id, sampleStatus, now);
    await render(<ResourceHistory />);

    expect(screen.getByLabelText("Memory, 25%")).toBeOnTheScreen();
    const fiveMinute = screen.getByLabelText("5m load, 4%");
    expect(fiveMinute.props.accessibilityState).toMatchObject({ checked: false });
    await fireEvent.press(fiveMinute);
    expect(screen.getByLabelText("5m load, 4%").props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(screen.getByLabelText("Last hour"));
    expect(screen.getByLabelText(/^Resource history, last 1 h\./)).toBeOnTheScreen();
  });
});
