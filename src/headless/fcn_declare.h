#pragma once

#ifndef WLED_FCN_DECLARE_H
#define WLED_FCN_DECLARE_H

#include <cstdint>
#include <string>

#include "WiFi.h"

class Segment;
class AsyncWebServerRequest;
struct ArtPollReply;

using JsonObject = int;
using JsonDocument = int;

struct JsonVariant {
  bool isNull() const { return true; }
  template <typename T>
  bool is() const { return false; }
  template <typename T>
  T as() const { return T{}; }
};

template <typename DestType>
bool getJsonValue(const JsonVariant& element, DestType& destination) {
  if (!element.isNull() && element.template is<DestType>()) {
    destination = element.template as<DestType>();
    return true;
  }
  return false;
}

template <typename DestType, typename DefaultType>
bool getJsonValue(const JsonVariant& element, DestType& destination, const DefaultType defaultValue) {
  if (!getJsonValue(element, destination)) {
    destination = defaultValue;
    return true;
  }
  return false;
}

struct IPAddressSettings {
  IPAddress staticIP;
  IPAddress staticGW;
  IPAddress staticSN;
};

void loadCustomPalettes();
void prepareArtnetPollReply(ArtPollReply* reply);
void sendArtnetPollReply(ArtPollReply* reply, IPAddress ipAddress, uint16_t portAddress);
bool handleFileRead(AsyncWebServerRequest*, std::string path);
bool writeObjectToFileUsingId(const char* file, uint16_t id, const JsonDocument* content);
bool writeObjectToFile(const char* file, const char* key, const JsonDocument* content);
bool readObjectFromFileUsingId(const char* file, uint16_t id, JsonDocument* dest, const JsonDocument* filter = nullptr);
bool readObjectFromFile(const char* file, const char* key, JsonDocument* dest, const JsonDocument* filter = nullptr);

#ifdef WLED_ENABLE_GIF
byte renderImageToSegment(Segment& seg);
void endImagePlayback(Segment* seg);
#endif

#endif
