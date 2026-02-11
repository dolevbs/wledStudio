import { describe, expect, it } from "vitest";

import { EFFECT_OPTIONS } from "../src/config/simulationOptions";
import { WLED_EFFECT_CATALOG } from "../src/config/wledEffectCatalog";

describe("wled effect catalog", () => {
  it("exposes every generated upstream effect in the UI options", () => {
    expect(EFFECT_OPTIONS.length).toBe(WLED_EFFECT_CATALOG.length);
    expect(EFFECT_OPTIONS.length).toBeGreaterThanOrEqual(200);
    expect(EFFECT_OPTIONS[0]?.id).toBe(0);
    expect(EFFECT_OPTIONS.at(-1)?.id).toBe(WLED_EFFECT_CATALOG.at(-1)?.id);
  });
});
