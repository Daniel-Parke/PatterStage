/**
 * Types for derive-surface-ladder.mjs (T-0116).
 *
 * The tool is plain ESM so it can run from a bare `node` with no build step,
 * which leaves its own test unable to see the shapes: TypeScript infers
 * `derive()` as returning an object with only the key the literal was
 * initialised with, so every rung after `ground` is a type error. Same
 * arrangement as design-lint.d.mts and output-canary.d.mts next door, and for
 * the same reason: a test that lies about a real signature is a red build
 * waiting to happen.
 */

/** An sRGB colour, one byte per channel. */
export type Rgb = [number, number, number];

/** One rung: what it is for, what it is measured against, and what it owes. */
export interface Rung {
  name: string;
  against: "ground" | "panel";
  ratio: number;
  /** Which hue ray it travels: surfaces take the palette's, rules a cooler one. */
  ray?: "rule";
  why: string;
}

/** A solved colour, and the scale along the ray that produced it. */
export interface Solved {
  rgb: Rgb;
  hex: string;
  ratio: number;
  /** Position along the ray. One step below this must miss the target. */
  k: number;
}

/** A solved rung, carrying the requirement it was solved for. */
export interface DerivedRung extends Solved {
  against: "ground" | "panel";
  target: number;
  why: string;
}

/** The whole ladder, keyed by rung name, plus the ground it started from. */
export type Ladder = Record<string, DerivedRung> & {
  ground: { hex: string; rgb: Rgb; ratio: number };
};

export const GROUND: string;
export const HUE: Rgb;
export const RULE_HUE: Rgb;
export const LADDER: readonly Rung[];

export function luminance(c: Rgb | number[]): number;
export function contrast(a: Rgb | number[], b: Rgb | number[]): number;
export function hexToRgb(hex: string): Rgb;
export function rgbToHex(rgb: Rgb | number[]): string;
export function along(hue: Rgb | number[], k: number): Rgb;

/** The dimmest colour on `hue` that is lighter than `base` and clears `target`. */
export function solve(base: Rgb | number[], hue: Rgb | number[], target: number): Solved;

export function derive(): Ladder;
