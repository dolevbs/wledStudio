#pragma once

#include "Mock_Network.h"
#include <array>
#include <cstdint>

class IPAddress {
 public:
  constexpr IPAddress() : octets_{0, 0, 0, 0} {}
  constexpr explicit IPAddress(uint32_t packed)
      : octets_{static_cast<uint8_t>((packed >> 24U) & 0xFFU),
                static_cast<uint8_t>((packed >> 16U) & 0xFFU),
                static_cast<uint8_t>((packed >> 8U) & 0xFFU),
                static_cast<uint8_t>(packed & 0xFFU)} {}
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

using WiFiEvent_t = int;
