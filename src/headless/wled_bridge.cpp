#include "Mock_Arduino.h"

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
  Rgb primary{255, 170, 0};
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

bool extract_first_color(std::string_view json, Rgb& out) {
  const size_t col_pos = json.find("\"col\"");
  if (col_pos == std::string_view::npos) {
    return false;
  }

  const size_t first_open = json.find('[', col_pos);
  if (first_open == std::string_view::npos) {
    return false;
  }

  const size_t second_open = json.find('[', first_open + 1);
  if (second_open == std::string_view::npos) {
    return false;
  }

  size_t cursor = second_open + 1;
  int values[3] = {0, 0, 0};
  for (int i = 0; i < 3; i++) {
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

    values[i] = std::atoi(std::string{json.substr(cursor, end - cursor)}.c_str());
    cursor = end;
  }

  out = {clamp_u8(values[0]), clamp_u8(values[1]), clamp_u8(values[2])};
  return true;
}

Rgb apply_brightness(Rgb c) {
  const int scale = g_state.brightness;
  c.r = static_cast<uint8_t>((static_cast<int>(c.r) * scale) / 255);
  c.g = static_cast<uint8_t>((static_cast<int>(c.g) * scale) / 255);
  c.b = static_cast<uint8_t>((static_cast<int>(c.b) * scale) / 255);
  return c;
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
  const Rgb c = apply_brightness(g_state.primary);
  for (int i = 0; i < g_state.led_count; i++) {
    set_pixel(i, c);
  }
}

void fill_blink() {
  const uint32_t cycle = 120U + static_cast<uint32_t>(255 - g_state.speed) * 6U;
  const bool on = ((g_state.now / cycle) % 2U) == 0U;
  const Rgb c = on ? apply_brightness(g_state.primary) : Rgb{0, 0, 0};
  for (int i = 0; i < g_state.led_count; i++) {
    set_pixel(i, c);
  }
}

void fill_breath() {
  const float phase = static_cast<float>(g_state.now % 4096U) / 4096.0f;
  const float breath = 0.5f + 0.5f * std::sin(phase * 6.2831853f);
  const int scaled = static_cast<int>(std::round(static_cast<float>(g_state.brightness) * breath));
  const uint8_t prev = g_state.brightness;
  g_state.brightness = clamp_u8(scaled);
  fill_solid();
  g_state.brightness = prev;
}

void fill_rainbow() {
  const uint8_t sat = static_cast<uint8_t>(180 + (g_state.intensity / 4));
  const uint8_t base = static_cast<uint8_t>((g_state.now * (g_state.speed + 1U) / 24U) & 0xFFU);
  const int len = std::max(g_state.led_count, 1);
  for (int i = 0; i < g_state.led_count; i++) {
    const uint8_t hue = static_cast<uint8_t>(base + (i * 255 / len));
    set_pixel(i, apply_brightness(hsv_to_rgb(hue, sat, 255)));
  }
}

void fill_sparkle() {
  fill_solid();
  const int sparkles = std::max(1, (g_state.led_count * (g_state.intensity + 16)) / 2048);
  for (int i = 0; i < sparkles; i++) {
    const uint32_t n = hash_noise(static_cast<uint32_t>(i) * 0x9E3779B9U + g_state.now * 31U);
    const int idx = static_cast<int>(n % static_cast<uint32_t>(std::max(g_state.led_count, 1)));
    set_pixel(idx, apply_brightness({255, 255, 255}));
  }
}

void fill_chase() {
  const int stride = std::max(2, 14 - (g_state.speed / 20));
  const int head = static_cast<int>((g_state.now / 40U) % static_cast<uint32_t>(std::max(g_state.led_count, 1)));
  const Rgb fg = apply_brightness(g_state.primary);
  const Rgb bg = apply_brightness({0, 0, 0});

  for (int i = 0; i < g_state.led_count; i++) {
    const bool lit = ((i + head) % stride) == 0;
    set_pixel(i, lit ? fg : bg);
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
    case 9:
      fill_rainbow();
      break;
    case 20:
      fill_sparkle();
      break;
    case 28:
      fill_chase();
      break;
    default:
      fill_rainbow();
      break;
  }
}

void clear_error() {
  g_state.last_error.clear();
}

void set_error(std::string msg) {
  g_state.last_error = std::move(msg);
}

} // namespace

extern "C" {

void wled_init(int ledCount) {
  const int safe_count = std::max(1, std::min(ledCount, 100000));
  g_state.led_count = safe_count;
  g_state.frame_buffer.assign(static_cast<size_t>(safe_count) * 3U, 0);
  g_state.now = 0;
  clear_error();
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

    Rgb parsed_color{};
    if (extract_first_color(json, parsed_color)) {
      g_state.primary = parsed_color;
    }
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
  render_effect();
  return g_state.frame_buffer.data();
}

int wled_get_buffer_size() {
  return static_cast<int>(g_state.frame_buffer.size());
}

const char* wled_get_last_error() {
  return g_state.last_error.c_str();
}

} // extern "C"
