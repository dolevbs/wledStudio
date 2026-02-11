#if defined(WLED_STUDIO_USE_UPSTREAM) && (WLED_STUDIO_USE_UPSTREAM == 1)
#include "wled.h"
#include "../../vendor/WLED/wled00/FX.h"
namespace wled_studio {
extern uint64_t g_mock_millis;
inline void set_mock_millis(uint64_t value) { g_mock_millis = value; }
}
#else
#include "Mock_Arduino.h"
#endif

#include <algorithm>
#include <array>
#include <cctype>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <exception>
#include <string>
#include <string_view>
#include <vector>

#if defined(WLED_STUDIO_USE_UPSTREAM) && (WLED_STUDIO_USE_UPSTREAM == 1)
extern uint8_t sin8_t(uint8_t theta);
#endif

namespace {

struct Rgb {
  uint8_t r;
  uint8_t g;
  uint8_t b;
};

struct EngineState {
  int led_count = 0;
  std::vector<uint8_t> frame_buffer;
  bool power = true;
  uint8_t brightness = 128;
  uint8_t effect = 0;
  uint8_t speed = 128;
  uint8_t intensity = 128;
  uint8_t palette = 0;
  uint8_t custom1 = 0;
  uint8_t custom2 = 0;
  Rgb primary{255, 170, 0};
  Rgb secondary{0, 0, 0};
  Rgb tertiary{0, 0, 0};
  uint32_t now = 0;
  std::string last_error;
};

EngineState g_state;

uint8_t clamp_u8(int value) {
  return static_cast<uint8_t>(std::clamp(value, 0, 255));
}

bool extract_int(std::string_view json, std::string_view key, int& out) {
  const std::string pattern = std::string{"\""} + std::string{key} + "\"";
  const size_t key_pos = json.find(pattern);
  if (key_pos == std::string_view::npos) {
    return false;
  }

  const size_t colon = json.find(':', key_pos + pattern.size());
  if (colon == std::string_view::npos) {
    return false;
  }

  size_t value_start = colon + 1;
  while (value_start < json.size() && std::isspace(static_cast<unsigned char>(json[value_start]))) {
    value_start++;
  }

  size_t value_end = value_start;
  if (value_end < json.size() && (json[value_end] == '-' || json[value_end] == '+')) {
    value_end++;
  }
  while (value_end < json.size() && std::isdigit(static_cast<unsigned char>(json[value_end]))) {
    value_end++;
  }

  if (value_end == value_start || (value_end == value_start + 1 && (json[value_start] == '-' || json[value_start] == '+'))) {
    return false;
  }

  out = std::atoi(std::string{json.substr(value_start, value_end - value_start)}.c_str());
  return true;
}

bool extract_bool(std::string_view json, std::string_view key, bool& out) {
  const std::string pattern = std::string{"\""} + std::string{key} + "\"";
  const size_t key_pos = json.find(pattern);
  if (key_pos == std::string_view::npos) {
    return false;
  }

  const size_t colon = json.find(':', key_pos + pattern.size());
  if (colon == std::string_view::npos) {
    return false;
  }

  size_t value_start = colon + 1;
  while (value_start < json.size() && std::isspace(static_cast<unsigned char>(json[value_start]))) {
    value_start++;
  }

  if (json.substr(value_start, 4) == "true") {
    out = true;
    return true;
  }

  if (json.substr(value_start, 5) == "false") {
    out = false;
    return true;
  }

  if (value_start < json.size() && (json[value_start] == '0' || json[value_start] == '1')) {
    out = json[value_start] == '1';
    return true;
  }

  return false;
}

bool extract_color_slot(std::string_view json, int slot, Rgb& out) {
  if (slot < 0) {
    return false;
  }

  const size_t col_pos = json.find("\"col\"");
  if (col_pos == std::string_view::npos) {
    return false;
  }

  const size_t outer_open = json.find('[', col_pos);
  if (outer_open == std::string_view::npos) {
    return false;
  }

  size_t cursor = outer_open + 1;
  for (int current_slot = 0; current_slot <= slot; current_slot++) {
    const size_t color_open = json.find('[', cursor);
    if (color_open == std::string_view::npos) {
      return false;
    }

    cursor = color_open + 1;
    int values[3] = {0, 0, 0};
    for (int channel = 0; channel < 3; channel++) {
      while (cursor < json.size() && (std::isspace(static_cast<unsigned char>(json[cursor])) || json[cursor] == ',')) {
        cursor++;
      }

      size_t end = cursor;
      while (end < json.size() && std::isdigit(static_cast<unsigned char>(json[end]))) {
        end++;
      }

      if (end == cursor) {
        return false;
      }

      values[channel] = std::atoi(std::string{json.substr(cursor, end - cursor)}.c_str());
      cursor = end;
    }

    const size_t color_close = json.find(']', cursor);
    if (color_close == std::string_view::npos) {
      return false;
    }
    cursor = color_close + 1;

    if (current_slot == slot) {
      out = {clamp_u8(values[0]), clamp_u8(values[1]), clamp_u8(values[2])};
      return true;
    }
  }
  return false;
}

Rgb apply_brightness(Rgb c) {
  const int scale = g_state.brightness;
  c.r = static_cast<uint8_t>((static_cast<int>(c.r) * scale) / 255);
  c.g = static_cast<uint8_t>((static_cast<int>(c.g) * scale) / 255);
  c.b = static_cast<uint8_t>((static_cast<int>(c.b) * scale) / 255);
  return c;
}

Rgb scale_color(Rgb c, float scale) {
  c.r = clamp_u8(static_cast<int>(std::round(static_cast<float>(c.r) * scale)));
  c.g = clamp_u8(static_cast<int>(std::round(static_cast<float>(c.g) * scale)));
  c.b = clamp_u8(static_cast<int>(std::round(static_cast<float>(c.b) * scale)));
  return c;
}

bool has_visible_color(Rgb c) {
  return c.r > 0 || c.g > 0 || c.b > 0;
}

Rgb blend_color(Rgb a, Rgb b, float t) {
  const float clamped = (std::max)(0.0f, (std::min)(1.0f, t));
  return {
      clamp_u8(static_cast<int>(std::round(static_cast<float>(a.r) + (static_cast<float>(b.r) - static_cast<float>(a.r)) * clamped))),
      clamp_u8(static_cast<int>(std::round(static_cast<float>(a.g) + (static_cast<float>(b.g) - static_cast<float>(a.g)) * clamped))),
      clamp_u8(static_cast<int>(std::round(static_cast<float>(a.b) + (static_cast<float>(b.b) - static_cast<float>(a.b)) * clamped))),
  };
}

void set_pixel(int idx, Rgb c) {
  if (idx < 0 || idx >= g_state.led_count) {
    return;
  }

  const size_t off = static_cast<size_t>(idx) * 3U;
  g_state.frame_buffer[off] = c.r;
  g_state.frame_buffer[off + 1] = c.g;
  g_state.frame_buffer[off + 2] = c.b;
}

Rgb hsv_to_rgb(uint8_t h, uint8_t s, uint8_t v) {
  const float hf = static_cast<float>(h) / 255.0f * 6.0f;
  const float sf = static_cast<float>(s) / 255.0f;
  const float vf = static_cast<float>(v) / 255.0f;

  const int i = static_cast<int>(std::floor(hf));
  const float f = hf - static_cast<float>(i);
  const float p = vf * (1.0f - sf);
  const float q = vf * (1.0f - f * sf);
  const float t = vf * (1.0f - (1.0f - f) * sf);

  float r = 0.0f;
  float g = 0.0f;
  float b = 0.0f;
  switch (i % 6) {
    case 0:
      r = vf;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = vf;
      b = p;
      break;
    case 2:
      r = p;
      g = vf;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = vf;
      break;
    case 4:
      r = t;
      g = p;
      b = vf;
      break;
    case 5:
    default:
      r = vf;
      g = p;
      b = q;
      break;
  }

  return {
      static_cast<uint8_t>(std::round(r * 255.0f)),
      static_cast<uint8_t>(std::round(g * 255.0f)),
      static_cast<uint8_t>(std::round(b * 255.0f)),
  };
}

uint32_t hash_noise(uint32_t value) {
  value ^= value << 13;
  value ^= value >> 17;
  value ^= value << 5;
  return value;
}

void fill_solid() {
  for (int i = 0; i < g_state.led_count; i++) {
    const float blend = g_state.custom1 > 0
        ? (static_cast<float>(i) / static_cast<float>((std::max)(1, g_state.led_count - 1))) * (static_cast<float>(g_state.custom1) / 255.0f)
        : 0.0f;
    const Rgb base = blend > 0.0f ? blend_color(g_state.primary, g_state.secondary, blend) : g_state.primary;
    const Rgb c = apply_brightness(base);
    set_pixel(i, c);
  }
}

void fill_blink() {
  const uint32_t cycle = 120U + static_cast<uint32_t>(255 - g_state.speed) * 6U;
  const bool on = ((g_state.now / cycle) % 2U) == 0U;
  const float off_scale = g_state.custom1 > 0 ? static_cast<float>(g_state.custom1) / 255.0f : 0.2f;
  Rgb off{0, 0, 0};
  if (has_visible_color(g_state.secondary)) {
    off = apply_brightness(scale_color(g_state.secondary, off_scale));
  }
  const Rgb c = on ? apply_brightness(g_state.primary) : off;
  for (int i = 0; i < g_state.led_count; i++) {
    set_pixel(i, c);
  }
}

void fill_breath() {
  const int period = (std::max)(512, 4096 + (128 - static_cast<int>(g_state.speed)) * 24);
  const float phase = static_cast<float>(g_state.now % static_cast<uint32_t>(period)) / static_cast<float>(period);
  const float depth = g_state.custom1 > 0 ? static_cast<float>(g_state.custom1) / 255.0f : 1.0f;
  const float breath = 1.0f - depth + depth * (0.5f + 0.5f * std::sin(phase * 6.2831853f));
  const int scaled = static_cast<int>(std::round(static_cast<float>(g_state.brightness) * breath));
  const uint8_t prev = g_state.brightness;
  g_state.brightness = clamp_u8(scaled);
  fill_solid();
  g_state.brightness = prev;
}

Rgb palette_color_lookup(uint8_t pos, uint8_t sat) {
  const float t = static_cast<float>(pos) / 255.0f;
  switch (g_state.palette % 5U) {
    case 1:
      return t < 0.5f
          ? blend_color(g_state.primary, g_state.secondary, t * 2.0f)
          : blend_color(g_state.secondary, g_state.tertiary, (t - 0.5f) * 2.0f);
    case 2: {
      const float wave = (std::sin(t * 6.2831853f) + 1.0f) * 0.5f;
      return blend_color(g_state.primary, g_state.secondary, wave);
    }
    case 3: {
      const int slot = static_cast<int>(std::floor(t * 3.0f)) % 3;
      if (slot == 0) return g_state.primary;
      if (slot == 1) return g_state.secondary;
      return g_state.tertiary;
    }
    case 4:
      return blend_color(g_state.tertiary, g_state.primary, t);
    default:
      return blend_color(g_state.primary, hsv_to_rgb(pos, sat, 255), 0.35f);
  }
}

void fill_rainbow(bool cycle_mode) {
  const uint8_t sat = static_cast<uint8_t>(180 + (g_state.intensity / 4));
  const uint8_t base = static_cast<uint8_t>((g_state.now * (g_state.speed + 1U) / 24U) & 0xFFU);
  const int len = (std::max)(g_state.led_count, 1);
  const float spread_scale = cycle_mode ? 1.0f + static_cast<float>(g_state.custom1) / 64.0f : 1.0f;
  for (int i = 0; i < g_state.led_count; i++) {
    const int offset = static_cast<int>(std::floor(static_cast<float>(i) * 255.0f * spread_scale / static_cast<float>(len)));
    uint8_t hue = static_cast<uint8_t>(base + offset);
#if defined(WLED_STUDIO_USE_UPSTREAM) && (WLED_STUDIO_USE_UPSTREAM == 1)
    const uint8_t wobble = ::sin8_t(static_cast<uint8_t>(base + i));
    hue = static_cast<uint8_t>((static_cast<uint16_t>(hue) + wobble) / 2U);
#endif
    if (g_state.palette == 0U) {
      set_pixel(i, apply_brightness(hsv_to_rgb(hue, sat, 255)));
    } else {
      set_pixel(i, apply_brightness(palette_color_lookup(hue, sat)));
    }
  }
}

void fill_sparkle() {
  fill_solid();
  const int sparkles = (std::max)(1, (g_state.led_count * (g_state.intensity + 16)) / 2048);
  const int speed_factor = (std::max)(1, 31 + ((static_cast<int>(g_state.speed) - 128) / 4));
  const float secondary_mix = static_cast<float>(g_state.custom1) / 255.0f;
  Rgb sparkle = has_visible_color(g_state.secondary) ? g_state.secondary : Rgb{255, 255, 255};
  for (int i = 0; i < sparkles; i++) {
    const uint32_t n = hash_noise(static_cast<uint32_t>(i) * 0x9E3779B9U + g_state.now * static_cast<uint32_t>(speed_factor));
    const int idx = static_cast<int>(n % static_cast<uint32_t>((std::max)(g_state.led_count, 1)));
    Rgb sparkle_base = sparkle;
    if (g_state.palette > 0U) {
      const uint8_t pos = static_cast<uint8_t>((n + g_state.now) & 0xFFU);
      sparkle_base = blend_color(g_state.primary, g_state.secondary, static_cast<float>(pos) / 255.0f);
    }
    const Rgb sparkle_final = secondary_mix > 0.0f ? blend_color(sparkle_base, g_state.tertiary, secondary_mix) : sparkle_base;
    set_pixel(idx, apply_brightness(sparkle_final));
  }
}

void fill_chase() {
  const int stride = g_state.custom1 > 0 ? (std::max)(2, 2 + (g_state.custom1 / 18)) : (std::max)(2, 14 - (g_state.speed / 20));
  const int head = static_cast<int>((g_state.now / 40U) % static_cast<uint32_t>((std::max)(g_state.led_count, 1)));
  const Rgb fg = apply_brightness(g_state.primary);
  const Rgb bg = has_visible_color(g_state.tertiary) ? apply_brightness(scale_color(g_state.tertiary, 0.45f)) : Rgb{0, 0, 0};
  const int tail = g_state.custom2 / 52;

  for (int i = 0; i < g_state.led_count; i++) {
    const int phase = (i + head) % stride;
    if (phase == 0) {
      set_pixel(i, fg);
    } else if (tail > 0 && phase <= tail) {
      const float fade = 1.0f - static_cast<float>(phase) / static_cast<float>(tail + 1);
      set_pixel(i, {
          clamp_u8(static_cast<int>(std::round(static_cast<float>(fg.r) * fade + static_cast<float>(bg.r) * (1.0f - fade)))),
          clamp_u8(static_cast<int>(std::round(static_cast<float>(fg.g) * fade + static_cast<float>(bg.g) * (1.0f - fade)))),
          clamp_u8(static_cast<int>(std::round(static_cast<float>(fg.b) * fade + static_cast<float>(bg.b) * (1.0f - fade)))),
      });
    } else {
      set_pixel(i, bg);
    }
  }
}

void fill_mapped_effect() {
  const int len = (std::max)(g_state.led_count, 1);
  const int seed = g_state.effect;
  const int variant = seed % 6;

  switch (variant) {
    case 0: {
      const uint8_t sat = static_cast<uint8_t>(128 + (g_state.intensity / 2));
      for (int i = 0; i < g_state.led_count; i++) {
        float phase = std::fmod(static_cast<float>(i) / static_cast<float>(len) + static_cast<float>(g_state.now) * static_cast<float>(g_state.speed + 8) * 0.00002f + static_cast<float>(seed) * 0.013f, 1.0f);
        if (phase < 0.0f) phase += 1.0f;
        const Rgb color = g_state.palette > 0U
            ? palette_color_lookup(static_cast<uint8_t>(std::floor(phase * 255.0f)), sat)
            : blend_color(g_state.primary, g_state.secondary, phase);
        set_pixel(i, apply_brightness(color));
      }
      break;
    }
    case 1: {
      const int threshold = 24 + (g_state.intensity * 200 / 255);
      const float dim = 0.08f + static_cast<float>(g_state.custom1 + 16) / 1024.0f;
      for (int i = 0; i < g_state.led_count; i++) {
        const uint32_t n = hash_noise(static_cast<uint32_t>(i) * 0x9E3779B9U + g_state.now * static_cast<uint32_t>(11 + (seed % 17)));
        const bool lit = static_cast<int>(n & 0xFFU) < threshold;
        const float sparkle_t = static_cast<float>((n >> 8) & 0xFFU) / 255.0f;
        const Rgb sparkle = blend_color(g_state.primary, g_state.tertiary, sparkle_t);
        const Rgb dim_bg = scale_color(g_state.secondary, dim);
        set_pixel(i, apply_brightness(lit ? sparkle : dim_bg));
      }
      break;
    }
    case 2: {
      const uint32_t head_interval = static_cast<uint32_t>((std::max)(12, 42 - (g_state.speed / 8)));
      const int head = static_cast<int>((g_state.now / head_interval) % static_cast<uint32_t>(len));
      const int tail = 2 + ((g_state.custom2 + (seed % 32)) / 24);
      const Rgb bg = has_visible_color(g_state.tertiary) ? scale_color(g_state.tertiary, 0.1f) : Rgb{0, 0, 0};
      for (int i = 0; i < g_state.led_count; i++) {
        const int dist = (i - head + len) % len;
        Rgb color = bg;
        if (dist <= tail) {
          const float t = 1.0f - static_cast<float>(dist) / static_cast<float>((std::max)(1, tail));
          color = blend_color(bg, g_state.primary, t);
        }
        set_pixel(i, apply_brightness(color));
      }
      break;
    }
    case 3: {
      const int width = 1 + ((seed + g_state.custom1) % 9);
      const int shift = static_cast<int>(g_state.now / static_cast<uint32_t>((std::max)(14, 64 - (g_state.speed / 5))));
      for (int i = 0; i < g_state.led_count; i++) {
        const int band = ((i + shift) / width) % 3;
        const Rgb color = band == 0 ? g_state.primary : (band == 1 ? g_state.secondary : g_state.tertiary);
        set_pixel(i, apply_brightness(color));
      }
      break;
    }
    case 4: {
      const float speed = 0.002f + static_cast<float>(g_state.speed) / 255.0f * 0.016f;
      const float tertiary_mix = static_cast<float>(g_state.custom2) / 255.0f;
      for (int i = 0; i < g_state.led_count; i++) {
        const float wave = (std::sin(static_cast<float>(i) * (0.2f + static_cast<float>(seed % 7) * 0.04f) + static_cast<float>(g_state.now) * speed) + 1.0f) * 0.5f;
        const Rgb mixed = blend_color(blend_color(g_state.primary, g_state.secondary, wave), g_state.tertiary, tertiary_mix);
        set_pixel(i, apply_brightness(mixed));
      }
      break;
    }
    default: {
      const uint8_t sat = static_cast<uint8_t>(96 + static_cast<int>(std::round(static_cast<float>(g_state.intensity) * 0.6f)));
      const uint8_t base = static_cast<uint8_t>((g_state.now * (g_state.speed + 16U) / 18U) & 0xFFU);
      const float spread = 1.0f + static_cast<float>((seed + g_state.custom1) % 64) / 64.0f;
      for (int i = 0; i < g_state.led_count; i++) {
        const int hue_offset = static_cast<int>(std::floor(static_cast<float>(i) * 255.0f * spread / static_cast<float>(len)));
        const uint8_t hue = static_cast<uint8_t>(base + hue_offset);
        const Rgb color = g_state.palette > 0U ? palette_color_lookup(hue, sat) : hsv_to_rgb(hue, sat, 255);
        set_pixel(i, apply_brightness(color));
      }
      break;
    }
  }
}

void render_effect() {
  if (!g_state.power) {
    std::fill(g_state.frame_buffer.begin(), g_state.frame_buffer.end(), 0U);
    return;
  }

  switch (g_state.effect) {
    case 0:
      fill_solid();
      break;
    case 1:
      fill_blink();
      break;
    case 2:
      fill_breath();
      break;
    case 8:
      fill_rainbow(false);
      break;
    case 9:
      fill_rainbow(true);
      break;
    case 37:
    case 41:
    case 45:
    case 57:
    case 63:
      fill_rainbow(false);
      break;
    case 20:
      fill_sparkle();
      break;
    case 28:
      fill_chase();
      break;
    default:
      fill_mapped_effect();
      break;
  }
}

void clear_error() {
  g_state.last_error.clear();
}

void set_error(std::string msg) {
  g_state.last_error = std::move(msg);
}

#if defined(WLED_STUDIO_USE_UPSTREAM) && (WLED_STUDIO_USE_UPSTREAM == 1)
uint32_t to_wled_color(Rgb c) {
  return (static_cast<uint32_t>(c.r) << 16U) | (static_cast<uint32_t>(c.g) << 8U) | static_cast<uint32_t>(c.b);
}

void ensure_upstream_engine() {
  static int configured_led_count = 0;
  if (configured_led_count == g_state.led_count && strip.getSegmentsNum() > 0) {
    return;
  }

  strip = WS2812FX();
  strip.appendSegment(0, static_cast<uint16_t>(g_state.led_count), 0, 1);
  strip.setTransition(0);
  strip.finalizeInit();
  configured_led_count = g_state.led_count;
}

void apply_upstream_state() {
  ensure_upstream_engine();
  strip.setBrightness(g_state.power ? g_state.brightness : 0, true);

  Segment& seg = strip.getMainSegment();
  seg.setGeometry(0, static_cast<uint16_t>(g_state.led_count), 1, 0, 0, 0, 1, 0);
  seg.setOption(SEG_OPTION_ON, g_state.power);
  seg.mode = g_state.effect;
  seg.speed = g_state.speed;
  seg.intensity = g_state.intensity;
  seg.palette = g_state.palette;
  seg.custom1 = g_state.custom1;
  seg.custom2 = g_state.custom2;
  seg.colors[0] = to_wled_color(g_state.primary);
  seg.colors[1] = to_wled_color(g_state.secondary);
  seg.colors[2] = to_wled_color(g_state.tertiary);
  seg.markForReset();
  strip.trigger();
}

void render_upstream_effect() {
  if (g_state.frame_buffer.empty()) return;
  strip.service();
  for (int i = 0; i < g_state.led_count; i++) {
    const uint32_t c = strip.getPixelColorNoMap(static_cast<unsigned>(i));
    const size_t off = static_cast<size_t>(i) * 3U;
    g_state.frame_buffer[off] = static_cast<uint8_t>((c >> 16U) & 0xFFU);
    g_state.frame_buffer[off + 1] = static_cast<uint8_t>((c >> 8U) & 0xFFU);
    g_state.frame_buffer[off + 2] = static_cast<uint8_t>(c & 0xFFU);
  }
}
#endif

} // namespace

extern "C" {

void wled_init(int ledCount) {
  const int safe_count = (std::max)(1, (std::min)(ledCount, 100000));
  g_state.led_count = safe_count;
  g_state.frame_buffer.assign(static_cast<size_t>(safe_count) * 3U, 0);
  g_state.now = 0;
  clear_error();
#if defined(WLED_STUDIO_USE_UPSTREAM) && (WLED_STUDIO_USE_UPSTREAM == 1)
  apply_upstream_state();
#endif
}

void wled_json_command(char* json_string) {
  try {
    if (json_string == nullptr) {
      set_error("json command pointer was null");
      return;
    }

    std::string_view json{json_string};
    clear_error();

    bool parsed_bool = false;
    if (extract_bool(json, "on", parsed_bool)) {
      g_state.power = parsed_bool;
    }

    int parsed_value = 0;
    if (extract_int(json, "bri", parsed_value)) {
      g_state.brightness = clamp_u8(parsed_value);
    }

    if (extract_int(json, "fx", parsed_value)) {
      g_state.effect = clamp_u8(parsed_value);
    }

    if (extract_int(json, "sx", parsed_value)) {
      g_state.speed = clamp_u8(parsed_value);
    }

    if (extract_int(json, "ix", parsed_value)) {
      g_state.intensity = clamp_u8(parsed_value);
    }

    if (extract_int(json, "pal", parsed_value)) {
      g_state.palette = clamp_u8(parsed_value);
    }
    if (extract_int(json, "c1", parsed_value)) {
      g_state.custom1 = clamp_u8(parsed_value);
    }
    if (extract_int(json, "c2", parsed_value)) {
      g_state.custom2 = clamp_u8(parsed_value);
    }

    Rgb parsed_color{};
    if (extract_color_slot(json, 0, parsed_color)) {
      g_state.primary = parsed_color;
    }
    if (extract_color_slot(json, 1, parsed_color)) {
      g_state.secondary = parsed_color;
    }
    if (extract_color_slot(json, 2, parsed_color)) {
      g_state.tertiary = parsed_color;
    }
#if defined(WLED_STUDIO_USE_UPSTREAM) && (WLED_STUDIO_USE_UPSTREAM == 1)
    apply_upstream_state();
#endif
  } catch (const std::exception& ex) {
    set_error(std::string{"json command failed: "} + ex.what());
  } catch (...) {
    set_error("json command failed: unknown error");
  }
}

uint8_t* wled_render_frame(uint32_t simulated_millis) {
  wled_studio::set_mock_millis(simulated_millis);
  g_state.now = simulated_millis;
  if (g_state.frame_buffer.empty()) {
    wled_init(1);
  }
#if defined(WLED_STUDIO_USE_UPSTREAM) && (WLED_STUDIO_USE_UPSTREAM == 1)
  render_upstream_effect();
#else
  render_effect();
#endif
  return g_state.frame_buffer.data();
}

int wled_get_buffer_size() {
  return static_cast<int>(g_state.frame_buffer.size());
}

const char* wled_get_last_error() {
  return g_state.last_error.c_str();
}

} // extern "C"
