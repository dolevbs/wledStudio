#pragma once

class MDNSResponder {
 public:
  bool begin(const char*) { return true; }
  void addService(const char*, const char*, uint16_t) {}
};

inline MDNSResponder MDNS;
