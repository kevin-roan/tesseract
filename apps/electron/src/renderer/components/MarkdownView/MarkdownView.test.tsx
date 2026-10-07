import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "../../test/render";
import { MarkdownView } from "./MarkdownView";

function Streaming() {
  const [text, setText] = useState("```\nabc\n```\n\nhello");
  return (
    <>
      <button type="button" onClick={() => setText(`${text} world`)}>
        more
      </button>
      <MarkdownView text={text} />
    </>
  );
}

describe("MarkdownView", () => {
  it("renders blocks with the right structure", () => {
    const { container } = renderWithProviders(
      <MarkdownView text={"# Head\n\nSome `code` and [link](https://x.dev)\n\n```sh\nls\n```\n\n- [x] done"} />,
    );
    expect(screen.getByText("Head").className).toContain("h3");
    expect(container.querySelector("code")?.textContent).toBe("code");
    expect(screen.getByText("link").getAttribute("href")).toBe("https://x.dev");
    expect(container.querySelector("pre")?.textContent).toBe("ls");
    expect(screen.getByText("sh")).toBeTruthy();
    expect(screen.getByText("☑")).toBeTruthy();
  });

  it("keeps code blocks mounted while later text streams in", () => {
    const { container } = renderWithProviders(<Streaming />);
    const pre = container.querySelector("pre");
    fireEvent.click(screen.getByText("more"));
    expect(container.querySelector("pre")).toBe(pre);
    expect(screen.getByText("hello world")).toBeTruthy();
  });

  it("prevents in-app navigation on link click", () => {
    renderWithProviders(<MarkdownView text="go https://x.dev now" />);
    const link = screen.getByText("https://x.dev");
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    fireEvent(link, event);
    expect(event.defaultPrevented).toBe(true);
  });
});
