import { fireEvent, screen } from "@testing-library/react";
import { Link } from "react-router";
import { describe, expect, it } from "vitest";
import { renderRoutes } from "../../test/render";
import { PageOutlet } from "./PageOutlet";
import { pageKeyOf } from "./use-page-key";

const routes = [
  {
    path: "/",
    element: (
      <>
        <Link to="/agents">agents</Link>
        <Link to="/projects/tesseract">project</Link>
        <PageOutlet />
      </>
    ),
    children: [{ path: ":pageId/*", element: <span data-testid="page">page</span> }],
  },
];

describe("PageOutlet", () => {
  it("keys the view by the root page so sub-views keep their view", () => {
    expect(pageKeyOf("/projects/tesseract/git")).toBe("projects");
    expect(pageKeyOf("/")).toBe("");
  });

  it("renders the matched page and swaps the view on page changes", () => {
    const { container } = renderRoutes(routes, "/overview");
    expect(screen.getByTestId("page")).toBeTruthy();
    expect(container.querySelector("[data-page-view]")?.getAttribute("data-page-view")).toBe("overview");
    fireEvent.click(screen.getByText("agents"));
    expect(container.querySelector("[data-page-view]")?.getAttribute("data-page-view")).toBe("agents");
    fireEvent.click(screen.getByText("project"));
    expect(container.querySelector("[data-page-view]")?.getAttribute("data-page-view")).toBe("projects");
  });
});
