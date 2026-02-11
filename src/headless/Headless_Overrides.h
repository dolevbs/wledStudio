#pragma once

#include <cstddef>
#include <cstdint>
#include <functional>

// Override ESPAsyncE131 dependency for headless/WASM builds.
#ifndef ESPASYNCE131_H_
#define ESPASYNCE131_H_

struct e131_packet_t {
  uint8_t raw[638];
};

class IPAddress;
using e131_packet_callback_function = void (*)(e131_packet_t*, IPAddress, uint8_t);

class ESPAsyncE131 {
 public:
  explicit ESPAsyncE131(e131_packet_callback_function = nullptr) {}

  bool begin(bool, uint16_t = 5568, uint16_t = 1, uint8_t = 1) {
    return true;
  }
};

class E131Priority {
 public:
  explicit E131Priority(uint8_t = 3) {}
  bool update(uint8_t) {
    return true;
  }
};

#ifndef P_E131
#define P_E131 0
#endif
#ifndef P_ARTNET
#define P_ARTNET 1
#endif
#ifndef P_DDP
#define P_DDP 2
#endif
#ifndef DDP_DEFAULT_PORT
#define DDP_DEFAULT_PORT 4048
#endif
#ifndef E131_DEFAULT_PORT
#define E131_DEFAULT_PORT 5568
#endif

#endif // ESPASYNCE131_H_

// Override AsyncJson-v6 dependency that requires AsyncWebServer internals.
#ifndef ASYNC_JSON_H_
#define ASYNC_JSON_H_

#define DYNAMIC_JSON_DOCUMENT_SIZE 1024

class AsyncWebServerRequest;
class JsonVariant;
class JsonArray;
class JsonObject;
class JsonDocument;

using ArJsonRequestHandlerFunction = std::function<void(AsyncWebServerRequest*)>;

class AsyncJsonResponse {
 public:
  explicit AsyncJsonResponse(size_t = DYNAMIC_JSON_DOCUMENT_SIZE, bool = false) {}
  explicit AsyncJsonResponse(JsonDocument*, bool = false) {}
  JsonVariant& getRoot();
};

class AsyncCallbackJsonWebHandler {
 public:
  explicit AsyncCallbackJsonWebHandler(const char*, ArJsonRequestHandlerFunction, size_t = DYNAMIC_JSON_DOCUMENT_SIZE) {}
};

#endif // ASYNC_JSON_H_
