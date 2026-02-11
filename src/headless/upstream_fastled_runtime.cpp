#define FASTLED_INTERNAL
#include <FastLED.h>

#include "../../vendor/FastLED/src/crgb.cpp.hpp"
#include "../../vendor/FastLED/src/hsv2rgb.cpp.hpp"
#include "../../vendor/FastLED/src/platforms/stub/Arduino.cpp.hpp"
#include "../../vendor/FastLED/src/lib8tion.cpp.hpp"
#include "../../vendor/FastLED/src/noise.cpp.hpp"
#include "../../vendor/FastLED/src/fl/colorutils.cpp.hpp"
#include "../../vendor/FastLED/src/fl/fill.cpp.hpp"
#include "../../vendor/FastLED/src/fl/stl/cstring.cpp.hpp"
#include "../../vendor/FastLED/src/fl/stl/allocator.cpp.hpp"
#include "../../vendor/FastLED/src/fl/stl/malloc.cpp.hpp"
#include "../../vendor/FastLED/src/fl/stl/time.cpp.hpp"
#include "../../vendor/FastLED/src/platforms/wasm/platform_time.cpp.hpp"
#include "../../vendor/FastLED/src/fl/details/crgb_extra.cpp.hpp"

namespace wled_studio {
uint64_t g_mock_millis = 0;
}

fl::u32 millis() {
  return static_cast<fl::u32>(wled_studio::g_mock_millis);
}

fl::u32 micros() {
  return static_cast<fl::u32>(wled_studio::g_mock_millis * 1000ULL);
}

void delay(int ms) {
  if (ms > 0) {
    wled_studio::g_mock_millis += static_cast<uint64_t>(ms);
  }
}

void delayMicroseconds(int us) {
  if (us > 0) {
    wled_studio::g_mock_millis += static_cast<uint64_t>(us) / 1000ULL;
  }
}

void yield() {}
