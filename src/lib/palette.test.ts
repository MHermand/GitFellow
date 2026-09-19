import { describe, expect, it } from "vitest";
import { DATA_HUE, rampFor, shadesFor, swatch, SWATCHES } from "./palette";

const luminance = (hex: string) =>
  [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);

describe("rampFor", () => {
  it("donne six paliers de plus en plus soutenus", () => {
    const ramp = rampFor(DATA_HUE);
    expect(ramp).toHaveLength(6);
    expect(ramp[4]).toBe(DATA_HUE);
    // Une rampe séquentielle ne doit jamais remonter en clarté.
    for (let i = 1; i < ramp.length; i += 1) {
      expect(luminance(ramp[i])).toBeLessThan(luminance(ramp[i - 1]));
    }
  });

  it("suit la teinte qu'on lui donne", () => {
    expect(rampFor(SWATCHES[1].dot)[4]).toBe(SWATCHES[1].dot);
    expect(rampFor(SWATCHES[1].dot)[2]).not.toBe(rampFor(DATA_HUE)[2]);
  });
});

describe("shadesFor", () => {
  it("part du ton le plus soutenu pour la plus grosse part", () => {
    const shades = shadesFor(DATA_HUE, 3);
    const ramp = rampFor(DATA_HUE);
    expect(shades).toEqual([ramp[5], ramp[4], ramp[3]]);
  });

  it("recommence la rampe au-delà de cinq parts", () => {
    const shades = shadesFor(DATA_HUE, 7);
    expect(shades[5]).toBe(shades[0]);
    expect(shades[6]).toBe(shades[1]);
  });
});

describe("swatch", () => {
  it("tourne sans jamais sortir du jeu", () => {
    expect(swatch(0)).toBe(SWATCHES[0]);
    expect(swatch(SWATCHES.length)).toBe(SWATCHES[0]);
    expect(swatch(-1)).toBe(SWATCHES[SWATCHES.length - 1]);
  });
});
