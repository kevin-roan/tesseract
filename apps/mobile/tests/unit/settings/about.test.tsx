import { fireEvent, render, screen } from "@testing-library/react-native";

import AboutScreen from "@/app/settings/about";
import { appRows, updateRows, updateStatusText, type AboutInfo, type UpdateStatus } from "@/features/settings/utils/about";
import { ABOUT_COPY } from "@/features/settings/utils/constants";

jest.mock("expo-router", () => ({ useIsFocused: () => true }));

const mockScreen = jest.fn();
jest.mock("@/features/settings/hooks/use-about-screen", () => ({ useAboutScreen: () => mockScreen() }));

const info: AboutInfo = {
  version: "1.0.0",
  build: "42",
  channel: "production",
  runtimeVersion: "abc123",
  updateId: null,
  createdAt: null,
  isEmbeddedLaunch: true,
  platform: "ios 18.0",
  isDev: false,
};

const idle: UpdateStatus = {
  enabled: true,
  checking: false,
  downloading: false,
  pending: false,
  checkedAt: null,
  checkError: null,
  downloadError: null,
};

function state(updates: object = {}) {
  return {
    back: jest.fn(),
    heroSize: 240,
    appRows: appRows(info),
    updateRows: updateRows(info),
    updates: {
      enabled: true,
      statusText: ABOUT_COPY.noCheck,
      busy: false,
      pending: false,
      checkError: null,
      downloadError: null,
      emergencyReason: null,
      check: jest.fn(),
      restart: jest.fn(),
      ...updates,
    },
  };
}

beforeEach(() => mockScreen.mockReset());

describe("about rows", () => {
  it("shows version, build and channel", () => {
    expect(appRows(info).map((row) => row.value)).toEqual(["1.0.0", "42", "ios 18.0", "Release"]);
    expect(updateRows(info).map((row) => row.id)).toEqual(["channel", "runtime", "launch"]);
  });

  it("adds the running update and falls back when no channel is set", () => {
    const rows = updateRows({ ...info, channel: null, updateId: "u-1", createdAt: new Date(0), isEmbeddedLaunch: false });
    expect(rows.find((row) => row.id === "channel")?.value).toBe(ABOUT_COPY.noChannel);
    expect(rows.find((row) => row.id === "update")?.value).toBe("u-1");
    expect(rows.find((row) => row.id === "launch")?.value).toBe(ABOUT_COPY.downloaded);
    expect(rows.some((row) => row.id === "published")).toBe(true);
  });

  it("describes the update state", () => {
    expect(updateStatusText(idle)).toBe(ABOUT_COPY.noCheck);
    expect(updateStatusText({ ...idle, checking: true })).toBe(ABOUT_COPY.checking);
    expect(updateStatusText({ ...idle, pending: true })).toBe(ABOUT_COPY.pending);
    expect(updateStatusText({ ...idle, checkedAt: new Date(0) })).toContain(ABOUT_COPY.upToDate);
    expect(updateStatusText({ ...idle, checkedAt: new Date(0), checkError: "boom" })).toBe(ABOUT_COPY.noCheck);
  });
});

describe("AboutScreen", () => {
  it("lists the app details and checks for updates", async () => {
    const value = state();
    mockScreen.mockReturnValue(value);
    await render(<AboutScreen />);

    expect(screen.getByTestId("about-tesseract", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText("1.0.0")).toBeOnTheScreen();
    expect(screen.getByText("production")).toBeOnTheScreen();
    expect(screen.getByText("abc123")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("about-check"));
    expect(value.updates.check).toHaveBeenCalled();
  });

  it("offers a restart once an update is downloaded", async () => {
    const value = state({ pending: true, statusText: ABOUT_COPY.pending });
    mockScreen.mockReturnValue(value);
    await render(<AboutScreen />);

    await fireEvent.press(screen.getByTestId("about-restart"));
    expect(value.updates.restart).toHaveBeenCalled();
  });

  it("explains when updates are off and shows check errors", async () => {
    mockScreen.mockReturnValue(state({ enabled: false }));
    await render(<AboutScreen />);
    expect(screen.getByText(ABOUT_COPY.disabledTitle)).toBeOnTheScreen();
    expect(screen.queryByTestId("about-check")).toBeNull();

    mockScreen.mockReturnValue(state({ checkError: "No network" }));
    await render(<AboutScreen />);
    expect(screen.getByText("No network")).toBeOnTheScreen();
  });
});
