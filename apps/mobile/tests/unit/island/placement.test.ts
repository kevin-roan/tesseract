import { cornerDock, dockCorner, dockPoint, nearestDock } from "@/features/island/utils/placement";

const bounds = { left: 16, right: 316, top: 60, bottom: 660 };

describe("orb placement", () => {
  it("docks to the nearest edge and keeps its place along it", () => {
    expect(nearestDock({ x: 30, y: 360 }, bounds)).toEqual({ edge: "left", offset: 0.5 });
    expect(nearestDock({ x: 300, y: 210 }, bounds)).toEqual({ edge: "right", offset: 0.25 });
    expect(nearestDock({ x: 166, y: 70 }, bounds)).toEqual({ edge: "top", offset: 0.5 });
    expect(nearestDock({ x: 91, y: 900 }, bounds)).toEqual({ edge: "bottom", offset: 0.25 });
  });

  it("settles into a corner when dropped near one", () => {
    const dock = nearestDock({ x: 20, y: 640 }, bounds);
    expect(dock).toEqual({ edge: "left", offset: 1 });
    expect(dockCorner(dock)).toBe("bottomLeft");
    expect(dockPoint(dock, bounds)).toEqual({ x: 16, y: 660 });
  });

  it("maps corners to docks and back", () => {
    for (const corner of ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const) {
      expect(dockCorner(cornerDock(corner))).toBe(corner);
    }
    expect(dockCorner({ edge: "top", offset: 0.5 })).toBeNull();
    expect(dockPoint({ edge: "top", offset: 0.5 }, bounds)).toEqual({ x: 166, y: 60 });
  });
});
