import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/render";
import { useConnectionClient, useConnectionView, usePoller } from "./hooks";
import { resetConnectionRuntime } from "./runtime";

afterEach(() => {
  resetConnectionRuntime();
});

function StatusProbe() {
  const view = useConnectionView();
  const client = useConnectionClient();
  return (
    <div>
      <span data-testid="label">{view.label}</span>
      <span data-testid="name">{view.title}</span>
      <span data-testid="client">{client?.baseUrl ?? "none"}</span>
    </div>
  );
}

let polls = 0;

function PollProbe({ enabled }: { enabled: boolean }) {
  const { loading } = usePoller(
    async () => {
      polls += 1;
      return polls;
    },
    60_000,
    { enabled },
  );
  return <span data-testid="loading">{String(loading)}</span>;
}

describe("connection hooks (fixture mode)", () => {
  it("connects to the fixture sandbox and exposes the client", async () => {
    renderWithProviders(<StatusProbe />);
    await waitFor(() => expect(screen.getByTestId("label").textContent).toBe("Online"));
    expect(screen.getByTestId("name").textContent).toBe("tesseract-sandbox");
    expect(screen.getByTestId("client").textContent).toBe("http://127.0.0.1:7700");
  });

  it("polls while enabled and stops when disabled", async () => {
    polls = 0;
    const view = renderWithProviders(<PollProbe enabled />);
    await waitFor(() => expect(polls).toBe(1));
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    await act(async () => view.rerender(<PollProbe enabled={false} />));
    expect(polls).toBe(1);
  });
});
