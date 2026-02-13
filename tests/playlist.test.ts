import { describe, expect, it } from "vitest";

import { normalizePlaylistPayload } from "../src/state/playlist";

describe("playlist normalization", () => {
  it("normalizes scalar timing fields and short arrays", () => {
    const result = normalizePlaylistPayload({
      ps: [1, 2, 3],
      dur: 100,
      transition: [1],
      repeat: 2,
      end: 0,
      r: false
    });

    expect(result.valid).toBe(true);
    expect(result.playlist?.dur).toEqual([100, 100, 100]);
    expect(result.playlist?.transition).toEqual([1, 1, 1]);
  });

  it("handles negative repeat as infinite plus shuffle", () => {
    const result = normalizePlaylistPayload({
      ps: [1, 2],
      dur: [100, 100],
      transition: [0, 0],
      repeat: -5,
      end: 0,
      r: false
    });

    expect(result.valid).toBe(true);
    expect(result.playlist?.repeat).toBe(0);
    expect(result.playlist?.r).toBe(true);
  });

  it("normalizes invalid end values", () => {
    const result = normalizePlaylistPayload({
      ps: [1],
      dur: 100,
      transition: 0,
      repeat: 0,
      end: 251,
      r: false
    });

    expect(result.valid).toBe(true);
    expect(result.playlist?.end).toBe(0);
  });

  it("clamps to 100 entries", () => {
    const ids = new Array<number>(130).fill(0).map((_, index) => (index % 250) + 1);
    const result = normalizePlaylistPayload({
      ps: ids,
      dur: 100,
      transition: 0,
      repeat: 0,
      end: 0,
      r: false
    });

    expect(result.valid).toBe(true);
    expect(result.playlist?.ps.length).toBe(100);
  });
});
