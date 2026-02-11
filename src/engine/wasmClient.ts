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

type ModuleFactory = () => Promise<EmscriptenModule>;

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
    return null;
  }

  try {
    if (!(self as unknown as { WLEDModule?: ModuleFactory }).WLEDModule) {
      importScripts("/wasm/wled.js");
    }

    const factory = (self as unknown as { WLEDModule?: ModuleFactory }).WLEDModule;
    return factory ?? null;
  } catch {
    return null;
  }
}

export async function createWledEngine(): Promise<WledEngine> {
  const factory = await loadModuleFactory();
  if (!factory) {
    return new SoftwareWledEngine();
  }

  try {
    const module = await factory();
    return new WasmBridgeEngine(module);
  } catch {
    return new SoftwareWledEngine();
  }
}
