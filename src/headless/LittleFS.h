#pragma once

class LittleFSFS {
 public:
  bool begin(bool = false, const char* = nullptr, uint8_t = 10) { return true; }
};

inline LittleFSFS LittleFS;
