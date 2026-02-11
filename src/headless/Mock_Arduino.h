#pragma once

#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <string>

using byte = uint8_t;

#ifndef PROGMEM
#define PROGMEM
#endif

#ifndef F
#define F(x) x
#endif

#ifndef PSTR
#define PSTR(x) x
#endif

namespace wled_studio {
inline uint64_t g_mock_millis = 0;

inline void set_mock_millis(uint64_t value) {
  g_mock_millis = value;
}
} // namespace wled_studio

inline uint32_t millis() {
  return static_cast<uint32_t>(wled_studio::g_mock_millis);
}

inline uint32_t micros() {
  return static_cast<uint32_t>(wled_studio::g_mock_millis * 1000ULL);
}

inline void delay(uint32_t ms) {
  wled_studio::g_mock_millis += ms;
}

inline long random(long max) {
  if (max <= 0) {
    return 0;
  }
  return std::rand() % max;
}

inline long random(long min, long max) {
  if (max <= min) {
    return min;
  }
  return min + (std::rand() % (max - min));
}

class MockSerial {
 public:
  template <typename T>
  void print(const T&) {}

  template <typename T>
  void println(const T&) {}

  template <typename... Args>
  void printf(const char*, Args...) {}
};

inline MockSerial Serial;
