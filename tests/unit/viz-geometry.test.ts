/** @jest-environment node */
// Pure geometry/scale helpers used by the SVG chart primitives.

import {
  polarPoint,
  niceMax,
  scaleLinear,
  cumulative,
  linePath,
} from "@/components/viz/geometry";

describe("polarPoint", () => {
  it("0° is straight up (12 o'clock)", () => {
    const p = polarPoint(50, 50, 10, 0);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(40, 5);
  });
  it("90° is to the right (clockwise)", () => {
    const p = polarPoint(50, 50, 10, 90);
    expect(p.x).toBeCloseTo(60, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });
});

describe("niceMax", () => {
  it.each([
    [0, 1],
    [-5, 1],
    [1, 1],
    [3, 5],
    [7, 10],
    [42, 50],
    [120, 200],
    [999, 1000],
  ])("niceMax(%d) → %d", (v, expected) => {
    expect(niceMax(v)).toBe(expected);
  });
});

describe("scaleLinear", () => {
  it("maps value range onto pixel range", () => {
    expect(scaleLinear(5, 0, 10, 0, 100)).toBe(50);
    expect(scaleLinear(0, 0, 10, 0, 100)).toBe(0);
    expect(scaleLinear(10, 0, 10, 0, 100)).toBe(100);
  });
  it("returns the midpoint when the domain is degenerate", () => {
    expect(scaleLinear(5, 3, 3, 0, 100)).toBe(50);
  });
});

describe("cumulative", () => {
  it("running sum", () => {
    expect(cumulative([1, 2, 3, 4])).toEqual([1, 3, 6, 10]);
    expect(cumulative([])).toEqual([]);
  });
});

describe("linePath", () => {
  it("builds an SVG move/line path", () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe("M0.0,0.0 L10.0,5.0");
  });
});
