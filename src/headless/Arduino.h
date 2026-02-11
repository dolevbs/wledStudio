#pragma once

#include "Mock_Arduino.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <limits>
#include <string>
#include <vector>

using String = std::string;
using StringSumHelper = std::string;

#ifndef PI
#define PI 3.14159265358979323846
#endif
#ifndef HALF_PI
#define HALF_PI (PI / 2.0)
#endif
#ifndef TWO_PI
#define TWO_PI (PI * 2.0)
#endif
#ifndef M_PI
#define M_PI PI
#endif
#ifndef M_PI_2
#define M_PI_2 HALF_PI
#endif
#ifndef M_TWOPI
#define M_TWOPI TWO_PI
#endif

#ifndef HIGH
#define HIGH 0x1
#endif
#ifndef LOW
#define LOW 0x0
#endif
#ifndef INPUT
#define INPUT 0x0
#endif
#ifndef OUTPUT
#define OUTPUT 0x1
#endif

template <typename T>
T constrain(T value, T low, T high) {
  return std::clamp(value, low, high);
}

template <typename T>
T min(T a, T b) {
  return std::min(a, b);
}

template <typename T>
T max(T a, T b) {
  return std::max(a, b);
}

inline long map(long x, long in_min, long in_max, long out_min, long out_max) {
  if (in_max == in_min) {
    return out_min;
  }
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

inline uint16_t word(uint8_t high, uint8_t low) {
  return static_cast<uint16_t>((static_cast<uint16_t>(high) << 8U) | low);
}

inline void pinMode(uint8_t, uint8_t) {}
inline void digitalWrite(uint8_t, uint8_t) {}
inline int digitalRead(uint8_t) { return LOW; }
inline void yield() {}
