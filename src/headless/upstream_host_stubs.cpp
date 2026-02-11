#include "wled.h"
#include "FX.h"

std::vector<Bus*> BusManager::busses{};

bool useParallelI2S = false;
uint8_t errorFlag = 0;
bool gammaCorrectCol = false;
bool gammaCorrectBri = false;
bool useGammaCorrectionBri = false;
bool stateChanged = false;
bool arlsDisableGammaCorrection = false;
bool useMainSegmentOnly = false;
bool doInitBusses = false;
bool correctWB = false;
uint8_t realtimeOverride = REALTIME_OVERRIDE_NONE;
uint8_t realtimeMode = REALTIME_MODE_INACTIVE;
bool realtimeRespectLedMaps = true;
uint8_t bri = 255;
uint16_t randomPaletteChangeTime = 60;
bool useHarmonicRandomPalette = false;
uint8_t blendingStyle = BLEND_STYLE_FADE;
std::time_t localTime = 0;
bool useAMPM = false;

um_data_t* simulateSound(uint8_t) {
  static um_data_t data{};
  return &data;
}

WS2812FX strip;

const char JSON_mode_names[] = "[]";
const char JSON_palette_names[] = "[]";

void loadCustomPalettes() {}

std::vector<CRGBPalette16> customPalettes{};

uint32_t color_blend(uint32_t c1, uint32_t c2, uint8_t blend) {
  const uint16_t inv = static_cast<uint16_t>(255 - blend);
  const uint8_t w = static_cast<uint8_t>((((c1 >> 24) & 0xFF) * inv + ((c2 >> 24) & 0xFF) * blend) / 255);
  const uint8_t r = static_cast<uint8_t>((((c1 >> 16) & 0xFF) * inv + ((c2 >> 16) & 0xFF) * blend) / 255);
  const uint8_t g = static_cast<uint8_t>((((c1 >> 8) & 0xFF) * inv + ((c2 >> 8) & 0xFF) * blend) / 255);
  const uint8_t b = static_cast<uint8_t>(((c1 & 0xFF) * inv + (c2 & 0xFF) * blend) / 255);
  return RGBW32(r, g, b, w);
}

uint32_t color_add(uint32_t a, uint32_t b, bool) {
  const uint8_t w = static_cast<uint8_t>(std::min(255U, ((a >> 24) & 0xFFU) + ((b >> 24) & 0xFFU)));
  const uint8_t r = static_cast<uint8_t>(std::min(255U, ((a >> 16) & 0xFFU) + ((b >> 16) & 0xFFU)));
  const uint8_t g = static_cast<uint8_t>(std::min(255U, ((a >> 8) & 0xFFU) + ((b >> 8) & 0xFFU)));
  const uint8_t bl = static_cast<uint8_t>(std::min(255U, (a & 0xFFU) + (b & 0xFFU)));
  return RGBW32(r, g, bl, w);
}

uint32_t color_fade(uint32_t c, uint8_t amount, bool) {
  const uint8_t scale = static_cast<uint8_t>(255 - amount);
  const uint8_t w = static_cast<uint8_t>(((c >> 24) & 0xFFU) * scale / 255U);
  const uint8_t r = static_cast<uint8_t>(((c >> 16) & 0xFFU) * scale / 255U);
  const uint8_t g = static_cast<uint8_t>(((c >> 8) & 0xFFU) * scale / 255U);
  const uint8_t b = static_cast<uint8_t>((c & 0xFFU) * scale / 255U);
  return RGBW32(r, g, b, w);
}

uint32_t adjust_color(uint32_t rgb, uint32_t, uint32_t, uint32_t) {
  return rgb;
}

uint32_t ColorFromPaletteWLED(const CRGBPalette16& pal, unsigned index, uint8_t brightness, TBlendType blendType) {
  CRGB c = ColorFromPalette(pal, static_cast<uint8_t>(index & 0xFFU), brightness, blendType);
  return RGBW32(c.r, c.g, c.b, 0);
}

CRGBPalette16 generateHarmonicRandomPalette(const CRGBPalette16& basepalette) {
  return basepalette;
}

CRGBPalette16 generateRandomPalette() {
  return RainbowColors_p;
}

void hsv2rgb(const CHSV32& hsv, uint32_t& rgb) {
  CHSV hsv8 = static_cast<CHSV>(hsv);
  CRGB out;
  hsv2rgb_rainbow(hsv8, out);
  rgb = RGBW32(out.r, out.g, out.b, 0);
}

void rgb2hsv(const uint32_t rgb, CHSV32& hsv) {
  const CRGB c(static_cast<uint8_t>((rgb >> 16) & 0xFFU), static_cast<uint8_t>((rgb >> 8) & 0xFFU), static_cast<uint8_t>(rgb & 0xFFU));
  hsv = CHSV32(rgb2hsv_approximate(c));
}

uint8_t NeoGammaWLEDMethod::gammaT[256] = {0};
uint8_t NeoGammaWLEDMethod::gammaT_inv[256] = {0};

uint8_t NeoGammaWLEDMethod::Correct(uint8_t value) {
  return value;
}

uint32_t NeoGammaWLEDMethod::inverseGamma32(uint32_t color) {
  return color;
}

void NeoGammaWLEDMethod::calcGammaTable(float) {}

int hour(std::time_t t) { return std::localtime(&t)->tm_hour; }
int minute(std::time_t t) { return std::localtime(&t)->tm_min; }
int second(std::time_t t) { return std::localtime(&t)->tm_sec; }
int day(std::time_t t) { return std::localtime(&t)->tm_mday; }
int month(std::time_t t) { return std::localtime(&t)->tm_mon + 1; }
int year(std::time_t t) { return std::localtime(&t)->tm_year + 1900; }

const char* monthShortStr(int m) {
  static const char* names[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
  if (m < 1 || m > 12) return "Jan";
  return names[m - 1];
}

const char* monthStr(int m) {
  static const char* names[] = {"January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"};
  if (m < 1 || m > 12) return "January";
  return names[m - 1];
}

int weekday(std::time_t t) {
  const auto* tm = std::localtime(&t);
  return tm ? tm->tm_wday + 1 : 1;
}

const char* dayStr(int d) {
  static const char* names[] = {"", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
  if (d < 1 || d > 7) return "Sunday";
  return names[d];
}

const char* dayShortStr(int d) {
  static const char* names[] = {"", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  if (d < 1 || d > 7) return "Sun";
  return names[d];
}

int extractModeDefaults(uint8_t, const char*) {
  return -1;
}

void endImagePlayback(Segment*) {}

unsigned Segment::_usedSegmentData = 0U;
uint16_t Segment::maxWidth = DEFAULT_LED_COUNT;
uint16_t Segment::maxHeight = 1;
unsigned Segment::_vLength = 0;
unsigned Segment::_vWidth = 0;
unsigned Segment::_vHeight = 0;
uint32_t Segment::_currentColors[NUM_COLORS] = {0, 0, 0};
CRGBPalette16 Segment::_currentPalette = CRGBPalette16(CRGB::Black);
CRGBPalette16 Segment::_randomPalette = CRGBPalette16(CRGB::Black);
CRGBPalette16 Segment::_newRandomPalette = CRGBPalette16(CRGB::Black);
uint16_t Segment::_lastPaletteChange = 0;
uint16_t Segment::_nextPaletteBlend = 0;
bool Segment::_modeBlend = false;
uint16_t Segment::_clipStart = 0;
uint16_t Segment::_clipStop = 0;
uint8_t Segment::_clipStartY = 0;
uint8_t Segment::_clipStopY = 1;

Segment::Segment(const Segment& orig) {
  std::memcpy(this, &orig, sizeof(Segment));
  _t = nullptr;
  name = nullptr;
  data = nullptr;
  pixels = nullptr;
  _dataLen = 0;
  if (orig.name) setName(orig.name);
  if (orig.data && allocateData(orig._dataLen)) std::memcpy(data, orig.data, orig._dataLen);
  if (orig.pixels && length() > 0) {
    pixels = static_cast<uint32_t*>(allocate_buffer(length() * sizeof(uint32_t), BFRALLOC_CLEAR));
    if (pixels) std::memcpy(pixels, orig.pixels, length() * sizeof(uint32_t));
  }
}

Segment::Segment(Segment&& orig) noexcept {
  std::memcpy(this, &orig, sizeof(Segment));
  orig._t = nullptr;
  orig.name = nullptr;
  orig.data = nullptr;
  orig.pixels = nullptr;
  orig._dataLen = 0;
}

Segment& Segment::operator=(const Segment& orig) {
  if (this == &orig) return *this;
  clearName();
  deallocateData();
  p_free(pixels);
  std::memcpy(this, &orig, sizeof(Segment));
  _t = nullptr;
  name = nullptr;
  data = nullptr;
  pixels = nullptr;
  _dataLen = 0;
  if (orig.name) setName(orig.name);
  if (orig.data && allocateData(orig._dataLen)) std::memcpy(data, orig.data, orig._dataLen);
  if (orig.pixels && length() > 0) {
    pixels = static_cast<uint32_t*>(allocate_buffer(length() * sizeof(uint32_t), BFRALLOC_CLEAR));
    if (pixels) std::memcpy(pixels, orig.pixels, length() * sizeof(uint32_t));
  }
  return *this;
}

Segment& Segment::operator=(Segment&& orig) noexcept {
  if (this == &orig) return *this;
  clearName();
  deallocateData();
  p_free(pixels);
  std::memcpy(this, &orig, sizeof(Segment));
  orig._t = nullptr;
  orig.name = nullptr;
  orig.data = nullptr;
  orig.pixels = nullptr;
  orig._dataLen = 0;
  return *this;
}

bool Segment::allocateData(size_t len) {
  if (len == 0) return false;
  if (data) d_free(data);
  data = static_cast<byte*>(allocate_buffer(len, BFRALLOC_CLEAR));
  if (!data) return false;
  _usedSegmentData += static_cast<unsigned>(len);
  _dataLen = static_cast<uint16_t>(len);
  return true;
}

void Segment::deallocateData() {
  if (data) d_free(data);
  data = nullptr;
  _dataLen = 0;
}

void Segment::beginDraw(uint16_t prog) {
  setDrawDimensions();
  if (isInTransition()) {
    _currentColors[0] = color_blend(_t->_colors[0], colors[0], static_cast<uint8_t>(prog >> 8));
    _currentColors[1] = color_blend(_t->_colors[1], colors[1], static_cast<uint8_t>(prog >> 8));
    _currentColors[2] = color_blend(_t->_colors[2], colors[2], static_cast<uint8_t>(prog >> 8));
  } else {
    _currentColors[0] = colors[0];
    _currentColors[1] = colors[1];
    _currentColors[2] = colors[2];
  }
  _currentPalette = loadPalette(_currentPalette, palette);
}

CRGBPalette16& Segment::loadPalette(CRGBPalette16& tgt, uint8_t) {
  tgt = _currentPalette;
  return tgt;
}

void Segment::setGeometry(uint16_t i1, uint16_t i2, uint8_t grp, uint8_t spc, uint16_t ofs, uint16_t i1Y, uint16_t i2Y, uint8_t m12) {
  start = i1;
  stop = i2;
  grouping = grp;
  spacing = spc;
  offset = ofs;
  startY = static_cast<uint8_t>(i1Y);
  stopY = static_cast<uint8_t>(i2Y);
  map1D2D = m12;
  if (!pixels && length() > 0) {
    pixels = static_cast<uint32_t*>(allocate_buffer(length() * sizeof(uint32_t), BFRALLOC_CLEAR));
  }
}

Segment& Segment::setColor(uint8_t slot, uint32_t c) {
  if (slot < NUM_COLORS) colors[slot] = c;
  return *this;
}

Segment& Segment::setCCT(uint16_t k) {
  cct = static_cast<uint8_t>(k > 255 ? 255 : k);
  return *this;
}

Segment& Segment::setOpacity(uint8_t o) {
  opacity = o;
  return *this;
}

Segment& Segment::setOption(uint8_t n, bool val) {
  if (val) options |= (1U << n);
  else options &= ~(1U << n);
  return *this;
}

Segment& Segment::setMode(uint8_t fx, bool) {
  mode = fx;
  return *this;
}

Segment& Segment::setPalette(uint8_t pal) {
  palette = pal;
  return *this;
}

Segment& Segment::setName(const char* n) {
  clearName();
  if (!n) return *this;
  const size_t len = std::strlen(n);
  name = static_cast<char*>(allocate_buffer(len + 1, BFRALLOC_CLEAR));
  if (name) std::memcpy(name, n, len);
  return *this;
}

void Segment::refreshLightCapabilities() const {}

uint16_t Segment::virtualLength() const { return length(); }
uint16_t Segment::maxMappingLength() const { return length(); }
unsigned Segment::virtualWidth() const { return is2D() ? width() : length(); }
unsigned Segment::virtualHeight() const { return is2D() ? height() : 1; }

bool Segment::isPixelClipped(int i) const { return i < 0 || i >= static_cast<int>(length()); }
uint32_t Segment::getPixelColor(int i) const { return isPixelClipped(i) || !pixels ? 0 : pixels[i]; }

void Segment::setPixelColor(int i, uint32_t c) const {
  if (isPixelClipped(i) || !pixels) return;
  pixels[i] = c;
  const int abs = static_cast<int>(start) + i;
  strip.setPixelColor(static_cast<unsigned>(abs), c);
}

#ifndef WLED_DISABLE_2D
bool Segment::isPixelXYClipped(int x, int y) const {
  return x < 0 || y < 0 || x >= static_cast<int>(virtualWidth()) || y >= static_cast<int>(virtualHeight());
}

uint32_t Segment::getPixelColorXY(int x, int y) const {
  if (isPixelXYClipped(x, y)) return 0;
  return getPixelColor(static_cast<int>(y * virtualWidth() + x));
}

void Segment::setPixelColorXY(int x, int y, uint32_t c) const {
  if (isPixelXYClipped(x, y)) return;
  setPixelColor(static_cast<int>(y * virtualWidth() + x), c);
}

void Segment::move(unsigned, unsigned, bool) const {}
void Segment::drawCircle(uint16_t, uint16_t, uint8_t, uint32_t, bool) const {}
void Segment::fillCircle(uint16_t, uint16_t, uint8_t, uint32_t, bool) const {}
void Segment::drawLine(uint16_t, uint16_t, uint16_t, uint16_t, uint32_t, bool) const {}
void Segment::drawCharacter(unsigned char, int16_t, int16_t, uint8_t, uint8_t, uint32_t, uint32_t, int8_t) const {}
void Segment::wu_pixel(uint32_t, uint32_t, CRGB) const {}
#endif

void Segment::blur(uint8_t, bool) const {}

void Segment::fill(uint32_t c) const {
  const int len = static_cast<int>(length());
  for (int i = 0; i < len; i++) setPixelColor(i, c);
}

void Segment::fade_out(uint8_t r) const {
  const int len = static_cast<int>(length());
  for (int i = 0; i < len; i++) setPixelColor(i, color_fade(getPixelColor(i), r, true));
}

void Segment::fadeToSecondaryBy(uint8_t fadeBy) const {
  const uint32_t secondary = colors[1];
  const int len = static_cast<int>(length());
  for (int i = 0; i < len; i++) {
    setPixelColor(i, color_blend(getPixelColor(i), secondary, fadeBy));
  }
}

void Segment::fadeToBlackBy(uint8_t fadeBy) const { fade_out(fadeBy); }

uint32_t Segment::color_from_palette(uint16_t index, bool, bool moving, uint8_t mcol, uint8_t pbri) const {
  const uint16_t shifted = moving ? static_cast<uint16_t>(index + strip.now / 32U) : index;
  if (mcol < NUM_COLORS) return color_blend(_currentColors[mcol], ColorFromPaletteWLED(_currentPalette, shifted, pbri), 128);
  return ColorFromPaletteWLED(_currentPalette, shifted, pbri);
}

uint32_t Segment::color_wheel(uint8_t pos) const {
  CHSV hsv(pos, 255, 255);
  CRGB rgb;
  hsv2rgb_rainbow(hsv, rgb);
  return RGBW32(rgb.r, rgb.g, rgb.b, 0);
}

void Segment::startTransition(uint16_t, bool) {
  if (_t) stopTransition();
}

uint8_t Segment::currentCCT() const { return cct; }
uint8_t Segment::currentBri() const { return opacity; }

void WS2812FX::finalizeInit() {
  if (_segments.empty()) appendSegment(0, _length, 0, 1);
  if (!_pixels) _pixels = static_cast<uint32_t*>(allocate_buffer(getLengthTotal() * sizeof(uint32_t), BFRALLOC_CLEAR));
}

void WS2812FX::service() {
  now = millis() + timebase;
  if (_segments.empty()) return;
  _segment_index = _mainSegment;
  _currentSegment = &_segments[_segment_index];
  _currentSegment->beginDraw();
  const uint8_t mode = _currentSegment->mode;
  if (mode < _mode.size() && _mode[mode]) {
    _mode[mode]();
  } else {
    fill(_currentSegment->colors[0]);
  }
  _lastShow = millis();
}

void WS2812FX::setCCT(uint16_t) {}

void WS2812FX::setBrightness(uint8_t b, bool) { _brightness = b; }

void WS2812FX::setRange(uint16_t i, uint16_t i2, uint32_t col) {
  if (i2 < i) std::swap(i, i2);
  for (uint16_t n = i; n <= i2 && n < getLengthTotal(); n++) setPixelColor(n, col);
}

void WS2812FX::purgeSegments() {
  _segments.erase(std::remove_if(_segments.begin(), _segments.end(), [](const Segment& s) { return !s.isActive(); }), _segments.end());
  if (_segments.empty()) appendSegment(0, _length, 0, 1);
}

void WS2812FX::setMainSegmentId(unsigned n) { _mainSegment = static_cast<uint8_t>(std::min<size_t>(n, _segments.size() - 1)); }
void WS2812FX::resetSegments() { for (auto& seg : _segments) seg.markForReset(); }
void WS2812FX::makeAutoSegments(bool) {}
void WS2812FX::fixInvalidSegments() {}
void WS2812FX::blendSegment(const Segment&) const {}
void WS2812FX::show() {}
void WS2812FX::setTargetFps(unsigned fps) { _targetFps = static_cast<uint8_t>(std::min(255U, fps)); }
void WS2812FX::waitForIt() {}
void WS2812FX::setRealtimePixelColor(unsigned i, uint32_t c) { setPixelColor(i, c); }
void WS2812FX::restartRuntime() {}
void WS2812FX::setTransitionMode(bool) {}
bool WS2812FX::checkSegmentAlignment() const { return true; }
bool WS2812FX::hasRGBWBus() const { return false; }
bool WS2812FX::hasCCTBus() const { return false; }
bool WS2812FX::deserializeMap(unsigned) { return false; }

uint8_t WS2812FX::getActiveSegmentsNum() const {
  uint8_t count = 0;
  for (const auto& seg : _segments) if (seg.isActive()) count++;
  return count;
}

uint8_t WS2812FX::getFirstSelectedSegId() const {
  for (uint8_t i = 0; i < _segments.size(); i++) if (_segments[i].isSelected()) return i;
  return 0;
}

uint8_t WS2812FX::getLastActiveSegmentId() const {
  for (int i = static_cast<int>(_segments.size()) - 1; i >= 0; i--) if (_segments[static_cast<size_t>(i)].isActive()) return static_cast<uint8_t>(i);
  return 0;
}

uint8_t WS2812FX::getActiveSegsLightCapabilities(bool) const { return 0; }

uint16_t WS2812FX::getLengthPhysical() const {
  uint16_t maxStop = 0;
  for (const auto& seg : _segments) maxStop = std::max(maxStop, seg.stop);
  return maxStop ? maxStop : _length;
}

uint16_t WS2812FX::getLengthTotal() const {
  return getLengthPhysical();
}
Segment& WS2812FX::getSegment(unsigned id) { return _segments[id < _segments.size() ? id : 0]; }
