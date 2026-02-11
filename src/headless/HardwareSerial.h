#pragma once

#if defined(WLED_STUDIO_USE_UPSTREAM)
#include <Arduino.h>
#else
#include "Mock_Arduino.h"

class HardwareSerial : public MockSerial {
 public:
  void begin(unsigned long, uint32_t = 0, int8_t = -1, int8_t = -1, bool = false) {}
};
#endif
