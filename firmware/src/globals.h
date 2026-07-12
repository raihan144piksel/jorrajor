#ifndef GLOBALS_H
#define GLOBALS_H

#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include "config.h"

// Pins
#define DHTPIN       23
#define DHTTYPE      DHT22
#define LDR_PIN      36   // GPIO36 (VP)
#define SOIL_PIN     39   // GPIO39 (VN)
#define RELAY_POMPA  32
#define RELAY_KIPAS  33
#define RELAY_LAMPU  25

// ADC Calibration Constants
#define SOIL_KERING  3200
#define SOIL_BASAH   1100
#define LDR_GELAP    4095
#define LDR_TERANG   0

// Timers (ms)
const unsigned long INTERVAL_BACA    = 2000;
const unsigned long DURASI_TRIGGER   = 6000;
const unsigned long DURASI_ON_POMPA  = 2000;
const unsigned long DURASI_ON_KIPAS  = 10000;
const unsigned long DURASI_ON_LAMPU  = 10000;
const unsigned long DURASI_COOLDOWN  = 10000;

// State Machine Enum
enum class RelayState : uint8_t {
  IDLE,
  TRIGGERED,
  ON,
  COOLDOWN
};

// Relay Entity (DOD Model)
struct RelayEntity {
  const char* name;
  int pin;
  RelayState state;
  unsigned long timerMulai;
  unsigned long durasiOn;
  bool statusOn;
  unsigned long timerNormal;
  
  int* overrideMode;
  bool (*checkCondition)();
};

// Cooperative Scheduler Task struct
struct Task {
  void (*callback)();
  unsigned long interval;
  unsigned long lastRun;
};

// Extern declarations of variables shared across modules
extern float suhu;
extern float humUdara;
extern float tanah;
extern float cahaya;

extern float suhuThreshold;
extern float soilThreshold;
extern float cahayaThreshold;

extern int overrideKipas;
extern int overridePompa;
extern int overrideLampu;

extern bool otaTriggered;
extern char otaTargetUrl[256];

extern bool pendingPublish;
extern bool pendingPreferencesSave;

extern RelayEntity relays[];
extern const int NUM_RELAYS;

extern Task tasks[];
extern const int NUM_TASKS;

extern WiFiClientSecure espClient;
extern PubSubClient mqttClient;
extern Preferences preferences;

// Zero-heap string utility helper
void toLowercase(const char* src, char* dest, size_t destSize);

#endif
