#pragma once

#include <cstddef>
#include <cstdint>

#ifndef PSTR
#define PSTR(x) x
#endif

#ifndef M_TWOPI
#define M_TWOPI 6.28318530717958647692
#endif

template <typename T>
constexpr T min(T a, T b) {
  return (a < b) ? a : b;
}

template <typename T>
constexpr T max(T a, T b) {
  return (a > b) ? a : b;
}

#ifndef IRAM_ATTR
#define IRAM_ATTR
#endif

#ifndef LEDC_CHANNEL_MAX
#define LEDC_CHANNEL_MAX 8
#endif

#ifndef LEDC_SPEED_MODE_MAX
#define LEDC_SPEED_MODE_MAX 2
#endif

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

// Skip AsyncJson-v6 dependency that requires AsyncWebServer internals.
#ifndef ASYNC_JSON_H_
#define ASYNC_JSON_H_
#endif // ASYNC_JSON_H_
