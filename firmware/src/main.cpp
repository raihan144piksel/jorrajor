#include <Arduino.h>
#include "globals.h"
#include "relay/RelayController.h"
#include "sensor/SensorReader.h"
#include "mqtt/MqttHandler.h"



// Define global shared variables
float suhu     = 0;
float humUdara = 0;
float tanah    = 0;
float cahaya   = 0;

float suhuThreshold   = 30.0;
float soilThreshold   = 40.0;
float cahayaThreshold = 20.0;

int overrideKipas = 0;
int overridePompa = 0;
int overrideLampu = 0;

bool otaTriggered = false;
char otaTargetUrl[256] = "";

bool pendingPublish = false;
bool pendingPreferencesSave = false;

// ============================================================
// Fungsi: checkKipas()
// Deskripsi: Memeriksa apakah suhu lingkungan melebihi ambang batas (suhuThreshold).
// Return: true jika suhu > suhuThreshold, sebaliknya false.
// ============================================================
bool checkKipas() { return suhu > suhuThreshold; }

// ============================================================
// Fungsi: checkPompa()
// Deskripsi: Memeriksa apakah kelembapan tanah berada di bawah ambang batas (soilThreshold).
// Return: true jika kelembapan tanah < soilThreshold, sebaliknya false.
// ============================================================
bool checkPompa() { return tanah < soilThreshold; }

// ============================================================
// Fungsi: checkLampu()
// Deskripsi: Memeriksa apakah intensitas cahaya berada di bawah ambang batas (cahayaThreshold).
// Return: true jika cahaya < cahayaThreshold, sebaliknya false.
// ============================================================
bool checkLampu() { return cahaya < cahayaThreshold; }

// Contiguous Array of Relay Entities (Data-Oriented Design)
RelayEntity relays[] = {
  { "KIPAS", RELAY_KIPAS, RelayState::IDLE, 0, DURASI_ON_KIPAS, false, 0, &overrideKipas, checkKipas },
  { "POMPA", RELAY_POMPA, RelayState::IDLE, 0, DURASI_ON_POMPA, false, 0, &overridePompa, checkPompa },
  { "LAMPU", RELAY_LAMPU, RelayState::IDLE, 0, DURASI_ON_LAMPU, false, 0, &overrideLampu, checkLampu }
};
const int NUM_RELAYS = sizeof(relays) / sizeof(relays[0]);

// Task Schedule Configuration (Cooperative Scheduler)
Task tasks[] = {
  { bacaSensor,   INTERVAL_BACA, 0 }, // Read sensors every 2s
  { publishData,  INTERVAL_BACA, 0 }  // Publish telemetry every 2s
};
const int NUM_TASKS = sizeof(tasks) / sizeof(tasks[0]);

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
Preferences preferences;

// ============================================================
// Fungsi: setup()
// Deskripsi: Fungsi inisialisasi awal sistem yang dijalankan sekali saat ESP32 pertama kali menyala.
//            Menginisialisasi komunikasi Serial, memuat konfigurasi ambang batas dari NVS,
//            mengatur pin-mode relay, serta menginisialisasi WiFi, sensor, dan MQTT client.
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 Smart Farm ===");

  // Load Thresholds from NVS Flash
  preferences.begin("smartfarm", false);
  suhuThreshold = preferences.getFloat("suhu", 30.0);
  soilThreshold = preferences.getFloat("soil", 40.0);
  cahayaThreshold = preferences.getFloat("cahaya", 50.0);
  Serial.printf("[Init] Loaded Thresholds -> Suhu:%.1f Soil:%.1f Cahaya:%.1f\n", suhuThreshold, soilThreshold, cahayaThreshold);

  // Auto-initialize pin modes from array configuration
  for (int i = 0; i < NUM_RELAYS; i++) {
    pinMode(relays[i].pin, OUTPUT);
    digitalWrite(relays[i].pin, LOW);
  }

  initSensors();
  setupWiFi();

  espClient.setInsecure();
  mqttClient.setBufferSize(512);
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println("[System] Siap!\n");
}

// ============================================================
// Fungsi: loop()
// Deskripsi: Fungsi utama yang berjalan terus-menerus (looping) setelah setup().
//            Bertanggung jawab untuk menjaga koneksi WiFi/MQTT, memproses pembacaan sensor,
//            menjalankan state machine relay, dan memicu pengiriman data telemetri secara berkala.
// ============================================================
void loop() {
  // 1. Process asynchronous network handlers
  jagaWiFi();
  jagaMQTT();
  
  if (mqttClient.connected()) {
    mqttClient.loop();
  }

  // 2. Execute OTA updates if triggered
  if (otaTriggered) {
    handleOTA();
  }

  // 3. Update actuator state machine every loop for sub-millisecond precision
  kontrolRelay();

  // 4. Run Cooperative Task Scheduler
  unsigned long now = millis();
  bool publishedThisCycle = false;
  for (int i = 0; i < NUM_TASKS; i++) {
    if (now - tasks[i].lastRun >= tasks[i].interval) {
      // Prevents timer drift
      tasks[i].lastRun = now;
      
      // Track if telemetry was published this loop cycle
      if (tasks[i].callback == publishData) {
        publishedThisCycle = true;
      }
      
      tasks[i].callback();
    }
  }

  // 5. Defer-logic: Flash write
  if (pendingPreferencesSave) {
    pendingPreferencesSave = false;
    preferences.putFloat("suhu", suhuThreshold);
    preferences.putFloat("soil", soilThreshold);
    preferences.putFloat("cahaya", cahayaThreshold);
    Serial.printf("[NVS] Tersimpan -> Suhu:%.1f Soil:%.1f Cahaya:%.1f\n", suhuThreshold, soilThreshold, cahayaThreshold);
  }

  // 6. Defer-logic: Instant publish on manual overrides
  if (pendingPublish && !publishedThisCycle) {
    pendingPublish = false;
    publishData();
  } else {
    pendingPublish = false;
  }
}
