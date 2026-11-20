import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import AccountScreen from "@/app/settings/account";
import SignInScreen from "@/app/(auth)/sign-in";
import SignUpScreen from "@/app/(auth)/sign-up";
import { useAccountStore } from "@/features/account/store/account-store";
import { ACCOUNT_COPY, AUTH_COPY } from "@/features/account/utils/content";
import { useTailnetStatus } from "@/features/tailnet";
import { confirm } from "@/lib/confirm";

import { createTestQueryClient, createWrapper } from "../sandbox/helpers";
import { runningStatus, sampleDevices, sampleSession } from "./fixtures";

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockApi = {
  me: jest.fn(),
  devices: jest.fn(),
  deleteAccount: jest.fn(),
  signOut: jest.fn(),
};

jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  get router() {
    return mockRouter;
  },
}));
jest.mock("@/features/account/api/client", () => ({ accountApi: () => mockApi }));
jest.mock("@/features/tailnet", () => ({
  connectTailnet: jest.fn(async () => undefined),
  disconnectTailnet: jest.fn(async () => undefined),
  useTailnetStatus: jest.fn(() => null),
}));
jest.mock("@/lib/confirm", () => ({ confirm: jest.fn(async () => true) }));
jest.mock("expo-device", () => ({ deviceName: "Dev's iPhone" }));
jest.mock("expo-apple-authentication", () => ({
  isAvailableAsync: jest.fn(async () => false),
  signInAsync: jest.fn(),
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}));

const renderWithQuery = (element: React.ReactElement) => render(element, { wrapper: createWrapper(createTestQueryClient()) });

beforeEach(() => {
  for (const fn of [...Object.values(mockApi), ...Object.values(mockRouter)]) fn.mockReset();
  mockRouter.canGoBack.mockReturnValue(true);
  mockApi.me.mockResolvedValue(sampleSession.account);
  mockApi.devices.mockResolvedValue({ devices: sampleDevices });
  mockApi.deleteAccount.mockResolvedValue(undefined);
  (useTailnetStatus as jest.Mock).mockReturnValue(runningStatus);
  (confirm as jest.Mock).mockReset().mockResolvedValue(true);
  useAccountStore.setState({ session: null, hydrated: true });
});

describe("auth screens", () => {
  it("renders the sign-in form and keeps pairing without an account reachable", async () => {
    await renderWithQuery(<SignInScreen />);
    expect(screen.getByTestId("auth-form-email")).toBeTruthy();
    expect(screen.queryByTestId("auth-form-name")).toBeNull();
    fireEvent.press(screen.getByText(AUTH_COPY.pairWithout));
    expect(mockRouter.push).toHaveBeenCalledWith("/pair");
  });

  it("asks for a name on sign-up", async () => {
    await renderWithQuery(<SignUpScreen />);
    expect(screen.getByTestId("auth-form-name")).toBeTruthy();
  });
});

describe("account screen", () => {
  it("offers sign-in when signed out", async () => {
    await renderWithQuery(<AccountScreen />);
    expect(screen.getByText(ACCOUNT_COPY.signedOutTitle)).toBeTruthy();
  });

  it("shows the account, network, devices and deletes the account in-app", async () => {
    useAccountStore.setState({ session: sampleSession, hydrated: true });
    await renderWithQuery(<AccountScreen />);
    expect(screen.getByText("Connected")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("sandbox")).toBeTruthy());
    fireEvent.press(screen.getByTestId("account-delete"));
    await waitFor(() => expect(mockApi.deleteAccount).toHaveBeenCalledWith(sampleSession.token));
    await waitFor(() => expect(screen.getByText(ACCOUNT_COPY.signedOutTitle)).toBeTruthy());
  });
});
