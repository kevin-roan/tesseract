import { act, fireEvent, render, screen } from "@testing-library/react-native";

import AboutScreen from "@/app/settings/about";
import {
  appRows,
  developerLinks,
  updateRows,
  updateStatusText,
  type AboutInfo,
  type UpdateStatus,
} from "@/features/settings/utils/about";
import { ABOUT_COPY, DEVELOPER } from "@/features/settings/utils/constants";
import { scrambleFrame } from "@/lib/scramble";
import { ScrambleMotion } from "@/theme";

jest.mock("expo-router", () => {
  const { cloneElement } = jest.requireActual("react");
  return {
    useIsFocused: () => true,
    Link: ({ href, children }: { href: string; children: React.ReactElement }) =>
      cloneElement(children, { onPress: () => mockOpen(href) }),
  };
});

const mockOpen = jest.fn();

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
    appRows: appRows(info),
    updateRows: updateRows(info),
    developer: developerLinks(),
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

beforeEach(() => {
  mockScreen.mockReset();
  mockOpen.mockReset();
});

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

describe("developer links", () => {
  it("links the name, website and GitHub profile", () => {
    expect(developerLinks().map((link) => [link.label, link.value, link.href])).toEqual([
      [DEVELOPER.name, undefined, DEVELOPER.website],
      [ABOUT_COPY.website, "kevinroan.com", DEVELOPER.website],
      [ABOUT_COPY.github, "github.com/kevin-roan", DEVELOPER.github],
    ]);
  });
});

describe("scrambleFrame", () => {
  it("scrambles everything at the start and settles left to right", () => {
    const random = () => 0;
    expect(scrambleFrame("ABC", 0, 0, random).every((letter) => !letter.settled)).toBe(true);
    expect(scrambleFrame("ABC", 0.5, 0, random).map((letter) => letter.settled)).toEqual([true, false, false]);
    expect(scrambleFrame("ABC", 1, 0.25, random).map((letter) => letter.char).join("")).toBe("ABC");
  });

  it("holds before settling and keeps spaces", () => {
    const frame = scrambleFrame("A B", 0.2, 0.25, () => 0.5);
    expect(frame.every((letter) => letter.char === " " || !letter.settled)).toBe(true);
    expect(frame[1]).toEqual({ char: " ", settled: true });
  });
});

describe("AboutScreen", () => {
  it("lists the app details and checks for updates", async () => {
    const value = state();
    mockScreen.mockReturnValue(value);
    await render(<AboutScreen />);

    expect(screen.getByText("Tesseract")).toBeOnTheScreen();
    expect(screen.getByText("1.0.0")).toBeOnTheScreen();
    expect(screen.getByText("production")).toBeOnTheScreen();
    expect(screen.getByText("abc123")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("about-check"));
    expect(value.updates.check).toHaveBeenCalled();
  });

  it("opens the developer links", async () => {
    mockScreen.mockReturnValue(state());
    await render(<AboutScreen />);

    expect(screen.getByText(DEVELOPER.name)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("about-developer-github"));
    expect(mockOpen).toHaveBeenCalledWith(DEVELOPER.github);
  });

  it("decodes the wordmark on long press, then restores it", async () => {
    jest.useFakeTimers();
    mockScreen.mockReturnValue(state());
    await render(<AboutScreen />);

    await fireEvent(screen.getByTestId("about-wordmark"), "longPress");
    expect(screen.queryByText("Tesseract")).toBeNull();
    await act(() => jest.advanceTimersByTime(ScrambleMotion.duration + ScrambleMotion.frame));
    expect(screen.getByText("Tesseract")).toBeOnTheScreen();
    jest.useRealTimers();
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
