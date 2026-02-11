#pragma once

class MockETHClass {
 public:
  bool begin() { return true; }
};

inline MockETHClass ETH;
