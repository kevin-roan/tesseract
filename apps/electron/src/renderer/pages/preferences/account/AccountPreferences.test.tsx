import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { accountFixtures, resetAccountFixture } from "../../../fixtures/account/ipc";
import { SIGNED_OUT } from "../../../fixtures/account/data";
import { overrideIpcFixtures } from "../../../fixtures/registry";
import { skipMotionDuringTests } from "../../../onboarding/shell/test-motion";
import { renderRoutes } from "../../../test/render";
import AccountPreferences from "./AccountPreferences";

const restores: (() => void)[] = [];

skipMotionDuringTests();

beforeEach(() => {
  resetAccountFixture();
  restores.push(overrideIpcFixtures(accountFixtures));
});

afterEach(() => {
  restores.splice(0).forEach((restore) => restore());
});

function render() {
  return renderRoutes([{ path: "*", element: <AccountPreferences /> }], "/overview?preferences=account");
}

describe("AccountPreferences", () => {
  it("shows the account and its Tesseract Network devices", async () => {
    render();
    expect(await screen.findByText("dev@example.com")).toBeTruthy();
    expect(await screen.findByText("devbox-host.tesseract.internal")).toBeTruthy();
    expect(screen.getByText(/Sandbox · Online · 100\.64\.0\.2/)).toBeTruthy();
  });

  it("removes a device after confirming", async () => {
    const removeDevice = vi.fn(() => []);
    restores.push(overrideIpcFixtures({ account: { removeDevice } }));
    render();
    await screen.findByText("iphone.tesseract.internal");
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[2]!);
    expect(await screen.findByText("Remove iphone.tesseract.internal?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" }).at(-1)!);
    await waitFor(() => expect(removeDevice).toHaveBeenCalledWith("3"));
  });

  it("deletes the account after confirming", async () => {
    const deleteAccount = vi.fn(() => SIGNED_OUT);
    restores.push(overrideIpcFixtures({ account: { deleteAccount } }));
    render();
    fireEvent.click(await screen.findByRole("button", { name: "Delete…" }));
    expect(await screen.findByText("Delete your Tesseract account?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
  });

  it("signs in when signed out", async () => {
    const signIn = vi.fn(accountFixtures.account!.signIn!);
    restores.push(overrideIpcFixtures({ account: { state: () => SIGNED_OUT, signIn } }));
    render();
    fireEvent.change(await screen.findByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter22" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(signIn).toHaveBeenCalledWith("me@example.com", "hunter22"));
    expect(await screen.findByText("me@example.com")).toBeTruthy();
  });
});
