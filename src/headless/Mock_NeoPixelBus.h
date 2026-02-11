#pragma once

#include <algorithm>
#include <cstddef>
#include <cstdint>
#include <vector>

struct RgbColor {
  uint8_t R;
  uint8_t G;
  uint8_t B;

  RgbColor() : R(0), G(0), B(0) {}
  RgbColor(uint8_t r, uint8_t g, uint8_t b) : R(r), G(g), B(b) {}
};

template <typename TFeature = void, typename TMethod = void>
class NeoPixelBus {
 public:
  explicit NeoPixelBus(size_t count, uint8_t = 0)
      : pixels_(count * 3U, 0), external_buffer_(nullptr), led_count_(count) {}

  void Begin() {}
  void Show() {}

  void AttachBuffer(uint8_t* buffer, size_t size) {
    external_buffer_ = buffer;
    external_size_ = size;
  }

  void SetPixelColor(size_t idx, const RgbColor& color) {
    if (idx >= led_count_) {
      return;
    }

    const size_t offset = idx * 3U;
    if (offset + 2U < pixels_.size()) {
      pixels_[offset] = color.R;
      pixels_[offset + 1U] = color.G;
      pixels_[offset + 2U] = color.B;
    }

    if (external_buffer_ && offset + 2U < external_size_) {
      external_buffer_[offset] = color.R;
      external_buffer_[offset + 1U] = color.G;
      external_buffer_[offset + 2U] = color.B;
    }
  }

  RgbColor GetPixelColor(size_t idx) const {
    if (idx >= led_count_) {
      return {};
    }
    const size_t offset = idx * 3U;
    return {pixels_[offset], pixels_[offset + 1U], pixels_[offset + 2U]};
  }

  size_t PixelCount() const {
    return led_count_;
  }

 private:
  std::vector<uint8_t> pixels_;
  uint8_t* external_buffer_;
  size_t external_size_ = 0;
  size_t led_count_;
};
