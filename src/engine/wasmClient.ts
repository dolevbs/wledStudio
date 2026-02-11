import { SoftwareWledEngine, type WledEngine } from "@/engine/softwareEngine";

interface EmscriptenModule {
  cwrap: (name: string, returnType: string | null, argTypes: string[]) => (...args: unknown[]) => unknown;
  UTF8ToString: (ptr: number) => string;
  stringToUTF8: (str: string, ptr: number, maxBytes: number) => void;
  lengthBytesUTF8: (str: string) => number;
  _malloc: (size: number) => number;
  _free: (ptr: number) => void;
  HEAPU8: Uint8Array;
}

interface EmscriptenFactoryOptions {
  locateFile?: (path: string, prefix: string) => string;
}

type ModuleFactory = (options?: EmscriptenFactoryOptions) => Promise<EmscriptenModule>;

class WasmBridgeEngine implements WledEngine {
  private readonly module: EmscriptenModule;
  private readonly initFn: (ledCount: number) => void;
  private readonly jsonFn: (ptr: number) => void;
  private readonly renderFn: (millis: number) => number;
  private readonly sizeFn: () => number;
  private readonly errorFn: () => number;

  constructor(module: EmscriptenModule) {
    this.module = module;
    this.initFn = module.cwrap("wled_init", null, ["number"]) as (ledCount: number) => void;
    this.jsonFn = module.cwrap("wled_json_command", null, ["number"]) as (ptr: number) => void;
    this.renderFn = module.cwrap("wled_render_frame", "number", ["number"]) as (millis: number) => number;
    this.sizeFn = module.cwrap("wled_get_buffer_size", "number", []) as () => number;
    this.errorFn = module.cwrap("wled_get_last_error", "number", []) as () => number;
  }

  init(ledCount: number): void {
    this.initFn(ledCount);
  }

  jsonCommand(payload: string): void {
    const len = this.module.lengthBytesUTF8(payload) + 1;
    const ptr = this.module._malloc(len);
    try {
      this.module.stringToUTF8(payload, ptr, len);
      this.jsonFn(ptr);
    } finally {
      this.module._free(ptr);
    }
  }

  renderFrame(simulatedMillis: number): Uint8Array {
    const ptr = this.renderFn(simulatedMillis);
    const size = this.getBufferSize();
    const view = this.module.HEAPU8.subarray(ptr, ptr + size);
    return new Uint8Array(view);
  }

  getBufferSize(): number {
    return Number(this.sizeFn());
  }

  getLastError(): string {
    const ptr = Number(this.errorFn());
    if (!ptr) {
      return "";
    }
    return this.module.UTF8ToString(ptr);
  }
}

async function loadModuleFactory(): Promise<ModuleFactory | null> {
  if (typeof self === "undefined") {
    console.log("[wasmClient] self is undefined; falling back to software engine");
    return null;
  }

  try {
    if (!(self as unknown as { WLEDModule?: ModuleFactory }).WLEDModule) {
      console.log("[wasmClient] importing /wasm/wled.js");
      importScripts("/wasm/wled.js");
    }

    const factory = (self as unknown as { WLEDModule?: ModuleFactory }).WLEDModule;
    if (!factory) {
      console.warn("[wasmClient] WLEDModule factory missing after importScripts");
    }
    return factory ?? null;
  } catch (error) {
    console.warn("[wasmClient] failed to load wasm module factory; using software engine", error);
    return null;
  }
}

export async function createWledEngine(): Promise<WledEngine> {
  const factory = await loadModuleFactory();
  if (!factory) {
    console.log("[wasmClient] software engine selected (no wasm factory)");
    return new SoftwareWledEngine();
  }

  try {
    console.log("[wasmClient] creating wasm engine instance");
    const module = await factory({
      locateFile: (path) => {
        if (path.endsWith(".wasm")) {
          return `/wasm/${path}`;
        }
        return path;
      }
    });
    console.log("[wasmClient] wasm engine ready");
    return new WasmBridgeEngine(module);
  } catch (error) {
    console.warn("[wasmClient] wasm engine creation failed; using software engine", error);
    return new SoftwareWledEngine();
  }
}
