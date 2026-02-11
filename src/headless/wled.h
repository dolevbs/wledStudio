#ifndef WLED_H
#define WLED_H

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <string>
#include <vector>
#include <ctime>
#include <cstdio>

#ifndef FIXED_PALETTE_COUNT
#define FIXED_PALETTE_COUNT 72
#endif

#include <Arduino.h>
#include <FastLED.h>
#include "colors.h"
#include "WiFi.h"
#include "Mock_Network.h"

using byte = uint8_t;
using uint = unsigned int;

#ifndef WLED_MAX_BUSSES
#define WLED_MAX_BUSSES 1
#endif

#ifndef DEFAULT_LED_COUNT
#define DEFAULT_LED_COUNT 30
#endif

#ifndef MODE_COUNT
#define MODE_COUNT 218
#endif

#ifndef WLED_MAX_SEGNAME_LEN
#define WLED_MAX_SEGNAME_LEN 32
#endif

#ifndef ERR_NORAM_PX
#define ERR_NORAM_PX 1
#endif
#ifndef ERR_NORAM
#define ERR_NORAM 2
#endif
#ifndef ERR_NOT_IMPL
#define ERR_NOT_IMPL 3
#endif

#ifndef WLED_O2_ATTR
#define WLED_O2_ATTR
#endif

#ifndef callMode
#define callMode uint8_t
#endif

#ifndef CALL_MODE_DIRECT_CHANGE
#define CALL_MODE_DIRECT_CHANGE 0
#endif
#ifndef CALL_MODE_WS_SEND
#define CALL_MODE_WS_SEND 1
#endif

#ifndef REALTIME_MODE_INACTIVE
#define REALTIME_MODE_INACTIVE 0
#endif
#ifndef REALTIME_OVERRIDE_NONE
#define REALTIME_OVERRIDE_NONE 0
#endif

#ifndef AW_GLOBAL_DISABLED
#define AW_GLOBAL_DISABLED 255
#endif

#ifndef USERMOD_ID_AUDIOREACTIVE
#define USERMOD_ID_AUDIOREACTIVE 32
#endif

#ifndef DYNAMIC_PALETTE_COUNT
#define DYNAMIC_PALETTE_COUNT 6
#endif

#ifndef FASTLED_PALETTE_COUNT
#define FASTLED_PALETTE_COUNT 7
#endif

inline void* p_malloc(size_t s) { return std::malloc(s); }
inline void* p_realloc(void* p, size_t s) { return std::realloc(p, s); }
inline void p_free(void* p) { std::free(p); }
inline void* d_malloc(size_t s) { return std::malloc(s); }
inline void* d_realloc(void* p, size_t s) { return std::realloc(p, s); }
inline void d_free(void* p) { std::free(p); }

constexpr uint8_t BFRALLOC_PREFER_PSRAM = 0x01;
constexpr uint8_t BFRALLOC_NOBYTEACCESS = 0x02;
constexpr uint8_t BFRALLOC_PREFER_DRAM = 0x04;
constexpr uint8_t BFRALLOC_CLEAR = 0x08;

inline void* allocate_buffer(size_t len, uint8_t flags = 0) {
  void* ptr = std::malloc(len);
  if (ptr && (flags & BFRALLOC_CLEAR)) {
    std::memset(ptr, 0, len);
  }
  return ptr;
}

inline uint8_t sin8_t(uint8_t theta) {
  return sin8(theta);
}

inline uint8_t hw_random8() {
  return random8();
}

inline uint8_t hw_random8(uint8_t maxv) {
  return maxv == 0 ? 0 : random8(maxv);
}

inline uint8_t hw_random8(uint8_t minv, uint8_t maxv) {
  if (maxv <= minv) return minv;
  return static_cast<uint8_t>(minv + random8(static_cast<uint8_t>(maxv - minv)));
}

inline uint16_t hw_random16() {
  return random16();
}

inline uint16_t hw_random16(uint16_t maxv) {
  return maxv == 0 ? 0 : random16(maxv);
}

inline uint16_t hw_random16(uint16_t minv, uint16_t maxv) {
  if (maxv <= minv) return minv;
  return static_cast<uint16_t>(minv + random16(static_cast<uint16_t>(maxv - minv)));
}

inline uint32_t hw_random() {
  return (static_cast<uint32_t>(random16()) << 16U) | random16();
}

inline uint32_t hw_random(uint32_t maxv) {
  return maxv == 0 ? 0 : (hw_random() % maxv);
}

inline int16_t sin16_t(uint16_t theta) {
  return sin16(theta);
}

inline uint8_t get_random_wheel_index(uint8_t base) {
  return static_cast<uint8_t>(base + random8());
}

inline uint8_t beatsin8_t(uint8_t bpm, uint8_t low = 0, uint8_t high = 255, uint32_t timebase = 0, uint8_t phase = 0) {
  return beatsin8(bpm, low, high, timebase, phase);
}

inline uint16_t beatsin16_t(uint16_t bpm, uint16_t low = 0, uint16_t high = 65535, uint32_t timebase = 0, uint16_t phase = 0) {
  return beatsin16(bpm, low, high, timebase, phase);
}

inline uint16_t beatsin88_t(uint16_t bpm88, uint16_t low = 0, uint16_t high = 65535, uint32_t timebase = 0, uint16_t phase = 0) {
  return beatsin88(bpm88, low, high, timebase, phase);
}

inline float sin_t(float x) { return std::sin(x); }
inline float cos_t(float x) { return std::cos(x); }
inline float atan2_t(float y, float x) { return std::atan2(y, x); }

inline uint8_t cos8_t(uint8_t x) { return cos8(x); }
inline int16_t cos16_t(uint16_t x) { return cos16(x); }

inline uint8_t perlin8(uint16_t x, uint16_t y = 0, uint16_t z = 0) { return inoise8(x, y, z); }
inline uint16_t perlin16(uint16_t x, uint16_t y = 0, uint16_t z = 0) { return inoise16(x, y, z); }

inline float mapf(float x, float in_min, float in_max, float out_min, float out_max) {
  if (in_max == in_min) return out_min;
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

template <typename T, typename U, typename V>
inline T constrain(T value, U low, V high) {
  const T low_t = static_cast<T>(low);
  const T high_t = static_cast<T>(high);
  return std::min(high_t, std::max(low_t, value));
}

inline uint32_t sqrt32_bw(uint32_t x) {
  return static_cast<uint32_t>(std::sqrt(static_cast<double>(x)));
}

#ifndef sprintf_P
#define sprintf_P std::sprintf
#endif
#ifndef strncmp_P
#define strncmp_P std::strncmp
#endif
#ifndef pgm_read_byte_near
#define pgm_read_byte_near(addr) (*reinterpret_cast<const uint8_t*>(addr))
#endif
#ifndef pgm_read_dword
#define pgm_read_dword(addr) (*reinterpret_cast<const uint32_t*>(addr))
#endif
#ifndef memcpy_P
#define memcpy_P std::memcpy
#endif

extern std::time_t localTime;
extern bool useAMPM;
int hour(std::time_t t);
int minute(std::time_t t);
int second(std::time_t t);
int day(std::time_t t);
int month(std::time_t t);
int year(std::time_t t);
const char* monthShortStr(int m);
const char* monthStr(int m);
const char* dayStr(int d);
const char* dayShortStr(int d);
int weekday(std::time_t t);

struct um_data_t {
  void* u_data[9]{};
};

class UsermodManager {
 public:
  static bool getUMData(um_data_t**, uint16_t) { return false; }
};

um_data_t* simulateSound(uint8_t simulationId);

class Bus {
 public:
  bool isOk() const { return true; }
  bool hasRGB() const { return true; }
  bool hasWhite() const { return false; }
  bool hasCCT() const { return false; }
  bool isPlaceholder() const { return false; }
  uint16_t getStart() const { return 0; }
  uint16_t getLength() const { return 0; }
  uint32_t getBusSize() const { return 0; }
  uint8_t getAutoWhiteMode() const { return 0; }

  static bool isDigital(uint8_t) { return false; }
  static bool is2Pin(uint8_t) { return false; }
  static bool hasRGB(uint8_t) { return true; }
  static bool hasWhite(uint8_t) { return false; }
  static bool hasCCT(uint8_t) { return false; }
  static bool is16bit(uint8_t) { return false; }
  static uint8_t getGlobalAWMode() { return AW_GLOBAL_DISABLED; }
  static int getCCT() { return 0; }
  static void setCCT(int) {}
};

struct BusConfig {
  uint8_t type = 0;
  uint16_t count = 0;
  uint16_t start = 0;
  uint8_t pins[2] = {0, 0};
  uint8_t colorOrder = 0;
  bool reversed = false;
  bool skip = false;

  uint32_t memUsage(uint8_t) const { return 0; }
};

class BusManager {
 public:
  static std::vector<Bus*> busses;

  static bool canAllShow() { return true; }
  static size_t getNumBusses() { return 0; }
  static Bus* getBus(size_t) { return nullptr; }
  static void removeAll() {}
  static int add(const BusConfig&, bool) { return 0; }
  static uint32_t memUsage() { return 0; }
  static void initializeABL() {}
  static void setSegmentCCT(int, bool = false) {}
  static void setPixelColor(uint16_t, uint32_t) {}
  static void show() {}
  static void setBrightness(uint8_t) {}
  static uint16_t getTotalLength(bool) { return 0; }
  static void useParallelOutput() {}
};

extern bool useParallelI2S;
extern uint8_t errorFlag;
extern bool gammaCorrectCol;
extern bool gammaCorrectBri;
extern bool useGammaCorrectionBri;
extern bool stateChanged;
extern bool arlsDisableGammaCorrection;
extern bool useMainSegmentOnly;
extern bool doInitBusses;
extern bool correctWB;
extern uint8_t realtimeOverride;
extern uint8_t realtimeMode;
extern bool realtimeRespectLedMaps;
extern uint8_t bri;
extern uint16_t randomPaletteChangeTime;
extern bool useHarmonicRandomPalette;
extern uint8_t blendingStyle;

constexpr uint8_t BLEND_STYLE_FADE = 0;
constexpr uint8_t BLEND_STYLE_FAIR = 1;
constexpr uint8_t SEG_OPTION_ON = 2;

class WS2812FX;
extern WS2812FX strip;
class Segment;
void endImagePlayback(Segment* seg);

extern const char JSON_mode_names[];
extern const char JSON_palette_names[];

#define DEBUG_PRINTLN(x)
#define DEBUG_PRINTF_P(...)

int extractModeDefaults(uint8_t mode, const char* key);

#endif // WLED_H
