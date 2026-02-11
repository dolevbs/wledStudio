# **PRD: WLED Studio (Headless C++ Edition)**

**Version:** 2.0 (Architecture Pivot)

**Status:** Approved for Implementation

**Focus:** Browser-based WLED simulation using upstream C++ source via Emscripten.

## ---

**1\. Executive Summary**

**WLED Studio** is a browser-native visualization tool that runs the actual WLED firmware logic inside a WebAssembly container.

Unlike previous iterations that proposed rewriting effects in Rust or TypeScript, this architecture utilizes a **Headless C++ Shim**. It compiles the upstream Aircoookie/WLED source code directly to WASM, ensuring 100% visual parity with physical hardware. The application renders the output using Three.js InstancedMesh for high performance (up to 5,000 LEDs @ 60fps) without requiring a physical controller or backend server.

### **Core Value Proposition**

1. **Bit-Perfect Accuracy:** Uses the exact same math (FX.cpp) as the firmware.  
2. **Zero-Hardware Prototyping:** Design complex matrix/strip layouts before buying components.  
3. **Safe Playground:** Experiment with configurations without risking boot loops or electrical shorts.

## ---

**2\. Vision & Principles**

### **Vision**

To create the standard "IDE" for WLED installations—where users design, simulate, and export configurations that are guaranteed to work on physical hardware.

### **Principles**

* **Upstream Parity:** We do not rewrite effects. We wrap the original C++.  
* **Zero Backend:** The entire stack runs client-side (Static SPA \+ WASM).  
* **High Performance:** Visuals must render at 60fps on standard integrated graphics.  
* **Strict Compatibility:** Input/Output must match WLED JSON schemas (v0.14+).

## ---

**3\. Product Scope**

### **3.1 In-Scope (MVP)**

* **WLED Submodule Integration:** Tracking Aircoookie/WLED (Tag: v0.14.0 or later).  
* **Headless C++ Engine:** A compile target that mocks Arduino.h, NeoPixelBus, and Network stacks.  
* **WASM Bridge:** A minimal C++ API exposing init, render, and json\_command to JavaScript.  
* **Visualization:** Three.js rendering of 1D Strips and 2D Matrices.  
* **Configuration:** Full support for presets.json and cfg.json import/export.

### **3.2 Out-of-Scope**

* **Real-time Hardware Control:** No E1.31, DDP, or ArtNet streaming to physical devices.  
* **Network Discovery:** No mDNS or local network scanning.  
* **Firmware Flashing:** No esptool-js integration.  
* **Filesystem Simulation:** No LittleFS/SPIFFS simulation (virtualized config only).

## ---

**4\. Architecture Overview**

### **4.1 Tech Stack**

| Layer | Technology | Role |
| :---- | :---- | :---- |
| **UI Framework** | Next.js (App Router) | Layout, Controls, State Management (Zustand). |
| **Renderer** | Three.js | InstancedMesh based rendering pipeline. |
| **Build Tool** | Emscripten (Docker) | Compiling C++ to .wasm. |
| **Core Logic** | C++ (Upstream WLED) | The actual effect engine (WS2812FX). |
| **Shim Layer** | C++ (Custom) | Mocks for Arduino HAL and Hardware pins. |

### **4.2 Data Flow**

1. **User Action:** User selects "Rainbow Runner" effect in React UI.  
2. **State Update:** Zustand updates the JSON state.  
3. **WASM Bridge:** JSON payload sent to C++ via wled\_json\_command().  
4. **Simulation:** FX.cpp processes the frame (mocked millis() advances time).  
5. **Render Output:** C++ writes RGB values to a shared Heap buffer.  
6. **Visualizer:** Three.js reads the buffer directly (Zero-Copy) and updates the mesh colors.

### **4.3 Hardware Shim Strategy (The "Mock" Layer)**

To compile WLED without an ESP32, the following must be implemented in the src/headless/ directory:

* **Mock\_Arduino.h:** millis(), micros(), delay(), random(), Serial.print.  
* **Mock\_NeoPixelBus.h:** A class that mimics the API but writes to a uint8\_t\* array.  
* **Mock\_Network.h:** Empty stubs for WiFi, AsyncWebServer, UDP.

## ---

**5\. Functional Requirements**

### **5.1 The Build System (DevOps)**

* **REQ-01:** Build process must use a Dockerized Emscripten environment to ensure reproducibility.  
* **REQ-02:** The Makefile must pull the specific git submodule tag of WLED before compiling.  
* **REQ-03:** The compilation must exclude wled\_server.cpp and alexa.cpp to reduce WASM size.

### **5.2 The WASM Interface**

The C++ wrapper must expose these methods to JavaScript:

C++

extern "C" {  
    // Initialize the strip with LED count and type  
    void wled\_init(int ledCount);  
      
    // Send a JSON command (same format as WLED HTTP API)  
    void wled\_json\_command(char\* json\_string);  
      
    // Calculate next frame and return pointer to RGB byte array  
    uint8\_t\* wled\_render\_frame(uint32\_t simulated\_millis);  
      
    // Get the size of the buffer  
    int wled\_get\_buffer\_size();  
}

### **5.3 Visualization & Mapping**

* **REQ-04:** Support **Linear Strips** (1D) and **Matrix Panels** (2D).  
* **REQ-05:** Support "Gaps" in LED indexing (e.g., distinct visual segments).  
* **REQ-06:** Render rate must be decoupled from Simulation rate (e.g., Sim at 30tps, Render at 60fps with interpolation if needed, though 1:1 is preferred).

### **5.4 Data Interoperability**

* **REQ-07:** Exported JSON must be valid against WLED v0.14 schema.  
* **REQ-08:** Imported JSON must gracefully handle missing fields (sanitize input).

## ---

**6\. Success Criteria & Metrics**

### **6.1 Performance**

* **Frame Budget:** WASM calculation time \< 4ms for 2,000 LEDs.  
* **FPS:** Maintain stable 60fps on M1 Air / Intel Iris Xe equivalent.  
* **Load Time:** WASM binary size \< 2MB (gzipped).

### **6.2 Fidelity**

* **Visual Parity:** Side-by-side comparison with a real ESP32 running "Noise" effects must match identically.  
* **Timing:** Transitions/Fades must adhere to the simulated millis() clock.

## ---

**7\. Tradeoffs & Risks**

### **Tradeoffs**

| Decision | Benefit | Sacrifice |
| :---- | :---- | :---- |
| **C++ / Emscripten** | Perfect logic parity with WLED firmware. | Complex build chain; larger binary size than Rust. |
| **No Backend** | Zero hosting cost; high privacy. | Cannot implement cloud syncing or social sharing features easily. |
| **InstancedMesh** | Extremely high rendering performance. | Harder to implement complex per-LED glow/volumetric effects compared to ShaderMaterial. |

### **Risks**

* **FastLED Assembly:** Some WLED effects use assembly-optimized math. *Mitigation:* Define FASTLED\_FORCE\_SOFTWARE\_SPI and FASTLED\_NO\_ASM flags during compilation.  
* **Memory Leaks:** Long-running simulations might leak heap in WASM. *Mitigation:* Strict RAII in the C++ wrapper and periodic "soft reset" capabilities.

## ---

**8\. Definition of Done (MVP)**

1. **Build:** Running npm run build:wasm successfully compiles FX.cpp \+ Shim into wled.wasm.  
2. **Render:** Browser displays a 30x30 matrix running the "Rainbow" effect at \>30fps.  
3. **Control:** Changing speed/intensity in the UI updates the WASM simulation immediately.  
4. **IO:** Can export the current state to a presets.json file that works on a physical ESP32.

## ---

**9\. Next Action Item**

**Initialize the Repository & Shim:**

Create the src/headless/ directory and write the Mock\_Arduino.h and Mock\_NeoPixelBus.h headers to satisfy the compiler dependencies for FX.cpp.