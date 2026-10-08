import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ROUTES } from "../app/routes";
import { renderRoutes } from "../test/render";

describe("shell", () => {
  it("renders the navigation and the default page in fixture mode", async () => {
    renderRoutes(ROUTES, "/overview?fixtures");
    expect(await screen.findByRole("link", { name: /Agents/ })).toBeTruthy();
    expect(await screen.findByText("tesseract")).toBeTruthy();
  });
});
