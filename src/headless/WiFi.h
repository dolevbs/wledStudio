#pragma once

#include "Mock_Network.h"
#include <array>
#include <cstdint>

class IPAddress {
 public:
  constexpr IPAddress() : octets_{0, 0, 0, 0} {}
  constexpr IPAddress(uint8_t a, uint8_t b, uint8_t c, uint8_t d) : octets_{a, b, c, d} {}

  constexpr uint8_t operator[](size_t index) const { return octets_[index]; }

 private:
  std::array<uint8_t, 4> octets_;
};

#ifndef WIFI_STA
#define WIFI_STA 1
#endif
#ifndef WIFI_AP
#define WIFI_AP 2
#endif
