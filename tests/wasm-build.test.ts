import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("wasm build script", () => {
  it("contains dockerized emscripten build and source exclusions", () => {
    const scriptPath = path.resolve(__dirname, "../scripts/build_wasm.sh");
    const script = fs.readFileSync(scriptPath, "utf8");

    expect(script).toContain("docker run --rm");
    expect(script).toContain("emscripten/emsdk");
    expect(script).toContain("wled_server.cpp");
    expect(script).toContain("alexa.cpp");
  });
});
