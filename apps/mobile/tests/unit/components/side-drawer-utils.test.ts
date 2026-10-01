import { badgeLabel } from "@/components/list-group/utils/badge";
import {
  DRAWER_MAX_WIDTH,
  dragProgress,
  drawerWidth,
  shouldCloseDrawer,
} from "@/components/side-drawer/utils/geometry";

describe("side drawer geometry", () => {
  it("takes most of a phone and caps on wide screens", () => {
    expect(drawerWidth(390)).toBe(335);
    expect(drawerWidth(1024)).toBe(DRAWER_MAX_WIDTH);
  });

  it("maps a leftward drag to closing progress", () => {
    expect(dragProgress(0, 300)).toBe(1);
    expect(dragProgress(-150, 300)).toBe(0.5);
    expect(dragProgress(-600, 300)).toBe(0);
    expect(dragProgress(80, 300)).toBe(1);
    expect(dragProgress(-10, 0)).toBe(1);
  });

  it("closes on a fast fling or a drag past the threshold", () => {
    expect(shouldCloseDrawer(0.9, -900)).toBe(true);
    expect(shouldCloseDrawer(0.4, 0)).toBe(true);
    expect(shouldCloseDrawer(0.4, 900)).toBe(false);
    expect(shouldCloseDrawer(0.8, -100)).toBe(false);
  });
});

describe("badgeLabel", () => {
  it.each([
    [undefined, null],
    [null, null],
    [0, null],
    [-2, null],
    [3, "3"],
    [120, "99+"],
    ["  ", null],
    ["New", "New"],
  ])("formats %p as %p", (badge, expected) => {
    expect(badgeLabel(badge)).toBe(expected);
  });
});
