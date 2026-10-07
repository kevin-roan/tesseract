import { fireEvent, render, screen } from "@testing-library/react";
import { MotionGlobalConfig } from "motion/react";
import { describe, expect, it, vi } from "vitest";
import { PROJECT_GALLERY_CARDS } from "./gallery-samples";
import { gridColumnTemplate, type ProjectCardModel } from "./model";
import { ProjectCard } from "./ProjectCard";
import { ProjectGrid } from "./ProjectGrid";

MotionGlobalConfig.skipAnimations = true;

const MINIMAL: ProjectCardModel = { id: "p1", title: "plain", activity: { label: "Idle", tone: "neutral" }, tags: [] };

describe("ProjectCard", () => {
  it("opens on click and asks without opening", () => {
    const onOpen = vi.fn();
    const onAsk = vi.fn();
    const model = PROJECT_GALLERY_CARDS[0] as ProjectCardModel;
    render(<ProjectCard model={model} onOpen={onOpen} onAsk={onAsk} />);
    fireEvent.click(screen.getByRole("button", { name: "Ask Claude about streaxfit" }));
    expect(onAsk).toHaveBeenCalledWith("streaxfit");
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "streaxfit" }));
    expect(onOpen).toHaveBeenCalledWith("streaxfit");
  });

  it("renders every badge, the commit row and tags", () => {
    render(<ProjectCard model={PROJECT_GALLERY_CARDS[0] as ProjectCardModel} onOpen={vi.fn()} />);
    for (const text of ["Confidential", "1 running", "main", "Uncommitted changes", "5d ago", "Web bundle", "Build script", "Node · pnpm · nimble-lotus"]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it("hides empty optional parts", () => {
    const { container } = render(<ProjectCard model={MINIMAL} onOpen={vi.fn()} />);
    expect(container.querySelector(".subtitle")).toBeNull();
    expect(container.querySelector(".commit")).toBeNull();
    expect(container.querySelector(".tags")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ask Claude/ })).toBeNull();
  });
});

describe("ProjectGrid", () => {
  it("is hidden when empty and keeps input order", () => {
    const { container, rerender } = render(<ProjectGrid items={[]} onOpen={vi.fn()} />);
    expect(container.firstChild).toBeNull();
    rerender(<ProjectGrid items={PROJECT_GALLERY_CARDS} onOpen={vi.fn()} />);
    const ids = Array.from(container.querySelectorAll("[data-project-id]")).map((node) => node.getAttribute("data-project-id"));
    expect(ids).toEqual(PROJECT_GALLERY_CARDS.map((card) => card.id));
  });

  it("caps the column count", () => {
    expect(gridColumnTemplate(280, 12, 3)).toBe("repeat(auto-fill, minmax(max(280px, (100% - 24px) / 3), 1fr))");
    expect(gridColumnTemplate(280, 12, 1)).toBe("minmax(0, 1fr)");
  });
});
