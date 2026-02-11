#pragma once

class MockWiFiClass {
 public:
  static constexpr int WL_CONNECTED = 3;

  int status() const {
    return WL_CONNECTED;
  }

  void mode(int) {}
  void begin(const char*, const char*) {}
};

inline MockWiFiClass WiFi;

class AsyncWebServer {
 public:
  explicit AsyncWebServer(int) {}
  void begin() {}
};

class AsyncWebServerRequest {};

class WiFiUDP {
 public:
  bool begin(unsigned int) {
    return true;
  }

  void stop() {}
};

struct ArtPollReply {
  unsigned char raw[239];
};
