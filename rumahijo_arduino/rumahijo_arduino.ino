/*
 * ============================================================
 *  ESP32 Smart Farm IoT System — v2.0
 * ============================================================
 *  DHT22      : GPIO 23
 *  LDR        : GPIO 36 (VP) — ADC1, analog
 *  Soil       : GPIO 39 (VN) — ADC1, analog
 *  Relay NO   :
 *    Pompa    : GPIO 32
 *    Kipas    : GPIO 33
 *    Lampu    : GPIO 25
 * ============================================================
 *  Library yang dibutuhkan:
 *  - PubSubClient     (Nick O'Leary)
 *  - DHT sensor library (Adafruit)
 *  - ArduinoJson      (Benoit Blanchon)
 *  Logika Relay:
 *  - Kondisi harus terus-menerus terpenuhi selama DURASI_TRIGGER
 *    (10 detik) → baru relay ON
 *  - Relay menyala minimal DURASI_ON masing-masing perangkat,
 *    setelah itu cek kondisi sensor lagi
 *  - Setelah relay mati, cooldown DURASI_COOLDOWN (120 detik)
 *    sebelum bisa nyala lagi
 *  - Manual override dari Node-RED/dashboard mengabaikan semua timer

 * ============================================================
 */

#include <WiFiManager.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <Preferences.h>
#include "config.h"

// ─────────────────────────────────────────────
//  PIN DEFINITIONS
// ─────────────────────────────────────────────
#define DHTPIN       23
#define DHTTYPE      DHT22
#define LDR_PIN      36   // GPIO36 (VP) — ADC1, input-only
#define SOIL_PIN     39   // GPIO39 (VN) — ADC1, input-only
#define RELAY_POMPA  32
#define RELAY_KIPAS  33
#define RELAY_LAMPU  25

// ─────────────────────────────────────────────
//  THRESHOLD (Dinamis dari Preferences)
// ─────────────────────────────────────────────
float suhuThreshold   = 30.0;   // °C  — kipas ON jika suhu > nilai ini
float soilThreshold   = 40.0;   // %   — pompa ON jika tanah < nilai ini
float cahayaThreshold = 50.0;   // %   — lampu ON jika cahaya < nilai ini

// ─────────────────────────────────────────────
//  KALIBRASI ADC
// ─────────────────────────────────────────────
#define SOIL_KERING  3200
#define SOIL_BASAH   1100
#define LDR_GELAP    4095
#define LDR_TERANG   0

// ─────────────────────────────────────────────
//  TIMER (dalam milidetik)
// ─────────────────────────────────────────────
const unsigned long INTERVAL_BACA    = 2000;    // baca sensor setiap 2 detik
const unsigned long DURASI_TRIGGER   = 6000;   // kondisi harus bertahan 6 detik → relay ON
const unsigned long DURASI_ON_POMPA  = 2000;   // pompa menyala minimal 2 detik
const unsigned long DURASI_ON_KIPAS  = 10000;   // kipas menyala minimal 10 detik
const unsigned long DURASI_ON_LAMPU  = 10000;   // lampu menyala minimal 10 detik
const unsigned long DURASI_COOLDOWN  = 10000;  // cooldown 10 detik setelah relay mati

// ─────────────────────────────────────────────
//  STATE MESIN UNTUK SETIAP RELAY
// ─────────────────────────────────────────────
enum RelayState {
  STATE_IDLE,      // normal, memantau kondisi
  STATE_TRIGGERED, // kondisi terpenuhi, menghitung waktu trigger
  STATE_ON,        // relay menyala, menghitung durasi ON
  STATE_COOLDOWN   // relay baru mati, dalam masa cooldown
};

// ─────────────────────────────────────────────
//  STRUCT: Data satu relay
// ─────────────────────────────────────────────
struct RelayControl {
  RelayState    state;
  unsigned long timerMulai;   // kapan state ini dimulai
  unsigned long durasiOn;     // durasi minimal ON (berbeda tiap relay)
  bool          statusOn;     // apakah relay sedang HIGH
  unsigned long timerNormal;  // sejak kapan kondisi kembali normal (Off-Debounce)
};

// ─────────────────────────────────────────────
//  OBJEK
// ─────────────────────────────────────────────
DHT          dht(DHTPIN, DHTTYPE);
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
Preferences preferences;

// ─────────────────────────────────────────────
//  DATA RELAY
// ─────────────────────────────────────────────
RelayControl rcPompa = { STATE_IDLE, 0, DURASI_ON_POMPA, false, 0 };
RelayControl rcKipas = { STATE_IDLE, 0, DURASI_ON_KIPAS, false, 0 };
RelayControl rcLampu = { STATE_IDLE, 0, DURASI_ON_LAMPU, false, 0 };

// ─────────────────────────────────────────────
//  VARIABEL SENSOR & STATUS
// ─────────────────────────────────────────────
float suhu     = 0;
float humUdara = 0;
float tanah    = 0;
float cahaya   = 0;

int overrideKipas = 0; // 0=AUTO, 1=ON, 2=OFF
int overridePompa = 0;
int overrideLampu = 0;

// Flag untuk OTA
bool otaTriggered = false;
char otaTargetUrl[256] = ""; // char[] statis lebih aman dari String (hindari heap fragmentation)

// Flag untuk defer publish & preferences write keluar dari MQTT callback
bool pendingPublish = false;
bool pendingPreferencesSave = false;

unsigned long lastBaca = 0;

// ═══════════════════════════════════════════════════════
//  WIFI — Koneksi & reconnect (WiFiManager)
// ═══════════════════════════════════════════════════════

void setupWiFi() {
  Serial.println("\n[WiFi] Memulai WiFiManager...");
  WiFiManager wm;
  
  // Timeout 3 menit agar jika mati listrik dan router lambat nyala, 
  // ESP tidak nyangkut selamanya sebagai Access Point.
  wm.setConfigPortalTimeout(180); 

  // AP bernama "SEMAI-SmartFarm", pass "admin123"
  if (!wm.autoConnect("SEMAI-SmartFarm", "admin123")) {
    Serial.println("[WiFi] Gagal konek atau timeout portal.");
    // Biarkan saja, jangan ESP.restart(), biarkan offline mode berjalan
  } else {
    Serial.printf("\n[WiFi] Terhubung! IP: %s\n", WiFi.localIP().toString().c_str());
  }
}

unsigned long lastWiFiCheck = 0;
void jagaWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastWiFiCheck >= 10000) { // Coba reconnect setiap 10 detik
      lastWiFiCheck = now;
      Serial.println("[WiFi] Terputus, mencoba reconnect...");
      WiFi.reconnect(); // WiFi otomatis menggunakan kredensial tersimpan
    }
  }
}

void publishData();

// ═══════════════════════════════════════════════════════
//  MQTT CALLBACK — terima perintah override dari dashboard
//  Payload JSON: {"kipas":true} / {"pompa":false} / dll
// ═══════════════════════════════════════════════════════
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT] Terima | %s\n", topic);

  // Abaikan pesan dari topik yang tidak dikenal
  bool isControl  = strcmp(topic, TOPIC_CONTROL) == 0;
  bool isSettings = strcmp(topic, TOPIC_SETTINGS) == 0;
  bool isOTA      = strcmp(topic, TOPIC_OTA) == 0;
  if (!isControl && !isSettings && !isOTA) return;

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[MQTT] JSON error: %s\n", err.c_str());
    return;
  }

  // ─── TOPIC_CONTROL: relay override ───────────────────
  if (isControl) {
    if (doc.containsKey("kipas")) {
      int cmd = doc["kipas"].is<bool>() ? (doc["kipas"].as<bool>() ? 1 : 0) : doc["kipas"].as<int>();
      overrideKipas = cmd;
      if (cmd == 1) {
        digitalWrite(RELAY_KIPAS, HIGH);
        rcKipas.statusOn = true;
        Serial.println("[Override] Kipas: MANUAL ON");
      } else if (cmd == 2) {
        digitalWrite(RELAY_KIPAS, LOW);
        rcKipas.statusOn  = false;
        Serial.println("[Override] Kipas: MANUAL OFF");
      } else {
        digitalWrite(RELAY_KIPAS, LOW);
        rcKipas.statusOn    = false;
        rcKipas.state       = STATE_IDLE;
        rcKipas.timerNormal = 0;
        Serial.println("[Override] Kipas: AUTO RESUMED");
      }
    }
    if (doc.containsKey("pompa")) {
      int cmd = doc["pompa"].is<bool>() ? (doc["pompa"].as<bool>() ? 1 : 0) : doc["pompa"].as<int>();
      overridePompa = cmd;
      if (cmd == 1) {
        digitalWrite(RELAY_POMPA, HIGH);
        rcPompa.statusOn = true;
        Serial.println("[Override] Pompa: MANUAL ON");
      } else if (cmd == 2) {
        digitalWrite(RELAY_POMPA, LOW);
        rcPompa.statusOn    = false;
        Serial.println("[Override] Pompa: MANUAL OFF");
      } else {
        digitalWrite(RELAY_POMPA, LOW);
        rcPompa.statusOn    = false;
        rcPompa.state       = STATE_IDLE;
        rcPompa.timerNormal = 0;
        Serial.println("[Override] Pompa: AUTO RESUMED");
      }
    }
    if (doc.containsKey("lampu")) {
      int cmd = doc["lampu"].is<bool>() ? (doc["lampu"].as<bool>() ? 1 : 0) : doc["lampu"].as<int>();
      overrideLampu = cmd;
      if (cmd == 1) {
        digitalWrite(RELAY_LAMPU, HIGH);
        rcLampu.statusOn = true;
        Serial.println("[Override] Lampu: MANUAL ON");
      } else if (cmd == 2) {
        digitalWrite(RELAY_LAMPU, LOW);
        rcLampu.statusOn    = false;
        Serial.println("[Override] Lampu: MANUAL OFF");
      } else {
        digitalWrite(RELAY_LAMPU, LOW);
        rcLampu.statusOn    = false;
        rcLampu.state       = STATE_IDLE;
        rcLampu.timerNormal = 0;
        Serial.println("[Override] Lampu: AUTO RESUMED");
      }
    }
    // Defer publish ke loop() — anti-pattern publish-in-callback PubSubClient
    pendingPublish = true;
  }

  // ─── TOPIC_SETTINGS: update threshold ────────────────
  else if (isSettings) {
    if (doc.containsKey("temp"))  suhuThreshold   = doc["temp"].as<float>();
    if (doc.containsKey("hum"))   soilThreshold   = doc["hum"].as<float>();
    if (doc.containsKey("light")) cahayaThreshold = doc["light"].as<float>();
    pendingPreferencesSave = true; // Tulis ke flash di-defer ke loop()
    pendingPublish = true;
    Serial.printf("[Settings] Diterima -> Suhu:%.1f Soil:%.1f Cahaya:%.1f\n",
                  suhuThreshold, soilThreshold, cahayaThreshold);
  }

  // ─── TOPIC_OTA: trigger firmware update ──────────────
  else if (isOTA && doc.containsKey("url")) {
    strlcpy(otaTargetUrl, doc["url"].as<const char*>(), sizeof(otaTargetUrl));
    otaTriggered = true;
    Serial.printf("[OTA] Perintah update diterima: %s\n", otaTargetUrl);
    // Kirim status MENUNGGU — publish di dalam OTA callback masih aman karena
    // ini adalah single short publish, bukan nested publish dari telemetri
    StaticJsonDocument<64> replyDoc;
    replyDoc["state_ota"] = "MENUNGGU";
    char buffer[64];
    serializeJson(replyDoc, buffer);
    mqttClient.publish(TOPIC_TELEMETRY, buffer);
  }
}


// ═══════════════════════════════════════════════════════
//  MQTT — Koneksi & reconnect + subscribe (NON-BLOCKING)
// ═══════════════════════════════════════════════════════
unsigned long lastMQTTCheck = 0;

void jagaMQTT() {
  if (!mqttClient.connected() && WiFi.status() == WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastMQTTCheck >= 5000) { // Coba reconnect setiap 5 detik
      lastMQTTCheck = now;
      Serial.printf("[MQTT] Konek ke %s...\n", MQTT_SERVER);
      
      if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
        Serial.println("[MQTT] Terhubung!");
        mqttClient.subscribe(TOPIC_CONTROL);
        mqttClient.subscribe(TOPIC_SETTINGS);
        mqttClient.subscribe(TOPIC_OTA);
        Serial.printf("[MQTT] Subscribe: %s, %s, & %s\n", TOPIC_CONTROL, TOPIC_SETTINGS, TOPIC_OTA);
      } else {
        Serial.printf("[MQTT] Gagal rc=%d\n", mqttClient.state());
      }
    }
  }
}


// ═══════════════════════════════════════════════════════
//  BACA SENSOR
// ═══════════════════════════════════════════════════════
void bacaSensor() {
  // DHT22
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) suhu     = t;
  if (!isnan(h)) humUdara = h;

  // Soil Moisture — rata-rata 4 sampel untuk meredam noise ADC ESP32
  long rawSoilSum = 0;
  for (int i = 0; i < 4; i++) rawSoilSum += analogRead(SOIL_PIN);
  int rawSoil = (int)(rawSoilSum / 4);
  float fTanah = (float)(rawSoil - SOIL_KERING) * 100.0f / (float)(SOIL_BASAH - SOIL_KERING);
  tanah = constrain(fTanah, 0.0f, 100.0f);

  // LDR Cahaya — rata-rata 4 sampel untuk meredam noise ADC ESP32
  long rawLDRSum = 0;
  for (int i = 0; i < 4; i++) rawLDRSum += analogRead(LDR_PIN);
  int rawLDR = (int)(rawLDRSum / 4);
  float fCahaya = (float)(rawLDR - LDR_GELAP) * 100.0f / (float)(LDR_TERANG - LDR_GELAP);
  cahaya = constrain(fCahaya, 0.0f, 100.0f);

  Serial.printf("[Sensor] Suhu:%.1f°C | Hum:%.1f%% | Tanah:%.1f%% | Cahaya:%.1f%%\n",
                suhu, humUdara, tanah, cahaya);
}


// ═══════════════════════════════════════════════════════
//  STATE MACHINE — Update satu relay
//
//  Alur state:
//
//  IDLE ──(kondisi terpenuhi)──► TRIGGERED
//    └─(kondisi tidak terpenuhi, reset)──► IDLE
//
//  TRIGGERED ──(sudah 10 detik terus-menerus)──► ON (relay HIGH)
//    └─(kondisi sempat normal, reset)──► IDLE
//
//  ON ──(durasi minimal tercapai DAN kondisi sudah normal)──► COOLDOWN (relay LOW)
//    └─(durasi minimal belum tercapai)──► tetap ON
//
//  COOLDOWN ──(120 detik selesai)──► IDLE
// ═══════════════════════════════════════════════════════
void updateRelay(RelayControl &rc, int pin, bool kondisiTerpenuhi,
                 int overrideMode, const char* namaRelay) {

  unsigned long now = millis();

  // ── Override aktif: bypass semua state machine ──────
  if (overrideMode != 0) return;

  switch (rc.state) {

    // ── IDLE: pantau apakah kondisi mulai terpenuhi ──
    case STATE_IDLE:
      if (kondisiTerpenuhi) {
        rc.state      = STATE_TRIGGERED;
        rc.timerMulai = now;
        Serial.printf("[%s] Kondisi terpenuhi, mulai hitung 10 detik...\n", namaRelay);
      }
      break;

    // ── TRIGGERED: hitung apakah kondisi bertahan 10 detik ──
    case STATE_TRIGGERED:
      if (!kondisiTerpenuhi) {
        // Kondisi sempat normal → reset ke IDLE
        rc.state = STATE_IDLE;
        Serial.printf("[%s] Kondisi tidak bertahan, reset ke IDLE\n", namaRelay);
      } else if (now - rc.timerMulai >= DURASI_TRIGGER) {
        // Durasi trigger terpenuhi → nyalakan relay
        digitalWrite(pin, HIGH);
        rc.statusOn    = true;
        rc.state       = STATE_ON;
        rc.timerMulai  = now;
        rc.timerNormal = 0; // Pastikan off-debounce selalu mulai bersih
        Serial.printf("[%s] %lu detik terpenuhi → RELAY ON\n", namaRelay, DURASI_TRIGGER/1000);

      }
      break;

    // ── ON: relay menyala, tunggu durasi minimal selesai ──
    case STATE_ON:
      if (now - rc.timerMulai >= rc.durasiOn) {
        // Durasi minimal tercapai
        if (!kondisiTerpenuhi) {
          if (rc.timerNormal == 0) {
            rc.timerNormal = now; // Mulai hitung durasi normal (off-debounce)
            Serial.printf("[%s] Kondisi terdeteksi normal, memulai off-debounce...\n", namaRelay);
          } else if (now - rc.timerNormal >= DURASI_TRIGGER) {
            // Kondisi sudah terbukti normal stabil selama DURASI_TRIGGER → matikan relay
            digitalWrite(pin, LOW);
            rc.statusOn   = false;
            rc.state      = STATE_COOLDOWN;
            rc.timerMulai = now;
            rc.timerNormal = 0;
            Serial.printf("[%s] Kondisi normal stabil → RELAY OFF → cooldown\n", namaRelay);
          }
        } else {
          // Kondisi buruk kembali → reset timer off-debounce
          if (rc.timerNormal != 0) {
            rc.timerNormal = 0;
            Serial.printf("[%s] Kondisi buruk kembali, membatalkan off-debounce\n", namaRelay);
          }
        }
      }
      // Kalau durasi minimal belum selesai, relay tetap ON apapun kondisinya
      break;

    // ── COOLDOWN: tunggu 120 detik sebelum bisa nyala lagi ──
    case STATE_COOLDOWN:
      if (now - rc.timerMulai >= DURASI_COOLDOWN) {
        rc.state = STATE_IDLE;
        Serial.printf("[%s] Cooldown selesai → kembali IDLE\n", namaRelay);
      }
      break;
  }
}


// ═══════════════════════════════════════════════════════
//  KONTROL SEMUA RELAY
// ═══════════════════════════════════════════════════════
void kontrolRelay() {
  // Kipas — kondisi: suhu > suhuThreshold
  updateRelay(
    rcKipas, RELAY_KIPAS,
    (suhu > suhuThreshold),
    overrideKipas, "KIPAS"
  );

  // Pompa — kondisi: tanah < soilThreshold
  updateRelay(
    rcPompa, RELAY_POMPA,
    (tanah < soilThreshold),
    overridePompa, "POMPA"
  );

  // Lampu — kondisi: cahaya < cahayaThreshold
  updateRelay(
    rcLampu, RELAY_LAMPU,
    (cahaya < cahayaThreshold),
    overrideLampu, "LAMPU"
  );
}


// ═══════════════════════════════════════════════════════
//  PUBLISH DATA KE MQTT
// ═══════════════════════════════════════════════════════
void publishData() {
  // Jangan publish jika MQTT tidak terkoneksi
  if (!mqttClient.connected()) return;

  // Label state untuk info di dashboard
  const char* stateLabel[] = { "IDLE", "TRIGGERED", "ON", "COOLDOWN" };

  JsonDocument doc;
  doc["device_id"]        = DEVICE_ID;
  doc["suhu"]             = suhu;
  doc["kelembapan_udara"] = humUdara;
  doc["tanah"]            = tanah;
  doc["cahaya"]           = cahaya;
  doc["status_kipas"]     = rcKipas.statusOn;
  doc["status_pompa"]     = rcPompa.statusOn;
  doc["status_lampu"]     = rcLampu.statusOn;
  doc["state_kipas"]      = overrideKipas != 0 ? "MANUAL" : stateLabel[rcKipas.state];
  doc["state_pompa"]      = overridePompa != 0 ? "MANUAL" : stateLabel[rcPompa.state];
  doc["state_lampu"]      = overrideLampu != 0 ? "MANUAL" : stateLabel[rcLampu.state];

  char buffer[512]; // Naikkan ke 512 agar konsisten dengan setBufferSize(512)
  serializeJson(doc, buffer);

  bool ok = mqttClient.publish(TOPIC_TELEMETRY, buffer);
  Serial.printf("[MQTT] Publish %s\n", ok ? "OK" : "GAGAL");
}


// ═══════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 Smart Farm v3.0 ===");

  // Muat Threshold dari Non-Volatile Memory (Flash)
  preferences.begin("smartfarm", false); // namespace, false = read/write
  suhuThreshold = preferences.getFloat("suhu", 30.0);
  soilThreshold = preferences.getFloat("soil", 40.0);
  cahayaThreshold = preferences.getFloat("cahaya", 50.0);
  Serial.printf("[Init] Loaded Thresholds -> Suhu:%.1f Soil:%.1f Cahaya:%.1f\n", suhuThreshold, soilThreshold, cahayaThreshold);

  // Init relay — semua OFF dulu
  pinMode(RELAY_POMPA, OUTPUT);
  pinMode(RELAY_KIPAS, OUTPUT);
  pinMode(RELAY_LAMPU, OUTPUT);
  digitalWrite(RELAY_POMPA, LOW);
  digitalWrite(RELAY_KIPAS, LOW);
  digitalWrite(RELAY_LAMPU, LOW);

  dht.begin();

  // Koneksi WiFi dengan WiFiManager
  setupWiFi();

  // Setup MQTT — perbesar buffer dari default 256 byte ke 512 byte
  // untuk menampung payload JSON yang lebih besar
  espClient.setInsecure();
  mqttClient.setBufferSize(512);
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  Serial.println("[System] Siap!\n");
}


// ═══════════════════════════════════════════════════════
//  LOOP UTAMA — tanpa delay(), pakai millis()
// ═══════════════════════════════════════════════════════
void loop() {
  // Jaga koneksi WiFi & MQTT secara Non-Blocking
  jagaWiFi();
  jagaMQTT();
  
  if (mqttClient.connected()) {
    mqttClient.loop();  // proses pesan masuk (callback)
  }

  // Eksekusi OTA jika dijadwalkan (di luar callback MQTT)
  if (otaTriggered) {
    otaTriggered = false;
    Serial.println("[OTA] Memulai HTTP Update...");
    
    StaticJsonDocument<256> replyDoc;
    replyDoc["state_ota"] = "MENDOWNLOAD";
    char buffer[256];
    serializeJson(replyDoc, buffer);
    mqttClient.publish(TOPIC_TELEMETRY, buffer);

    // Publish status MENGINSTALL tepat sebelum update dimulai.
    // Setelah HTTP_UPDATE_OK, ESP32 langsung restart — tidak sempat publish lagi.
    // Sehingga status ini menjadi pesan terakhir yang diterima backend.
    StaticJsonDocument<64> preOtaDoc;
    preOtaDoc["state_ota"] = "MENGINSTALL";
    char preOtaBuf[64];
    serializeJson(preOtaDoc, preOtaBuf);
    mqttClient.publish(TOPIC_TELEMETRY, preOtaBuf);
    mqttClient.loop(); // Pastikan paket terkirim sebelum koneksi terputus
    delay(200);        // Beri waktu broker menerima pesan

    t_httpUpdate_return ret;
    
    if (otaTargetUrl[0] != '\0' && strncmp(otaTargetUrl, "https://", 8) == 0) {
      WiFiClientSecure clientOTASecure;
      clientOTASecure.setInsecure();
      ret = httpUpdate.update(clientOTASecure, otaTargetUrl);
    } else {
      WiFiClient clientOTA;
      ret = httpUpdate.update(clientOTA, otaTargetUrl);
    }

    switch (ret) {
      case HTTP_UPDATE_FAILED:
        Serial.printf("[OTA] Gagal: %s\n", httpUpdate.getLastErrorString().c_str());
        replyDoc["state_ota"] = "GAGAL";
        break;
      case HTTP_UPDATE_NO_UPDATES:
        Serial.println("[OTA] Tidak ada update baru.");
        replyDoc["state_ota"] = "TIDAK_ADA_UPDATE";
        break;
      case HTTP_UPDATE_OK:
        Serial.println("[OTA] Update berhasil, me-restart...");
        replyDoc["state_ota"] = "BERHASIL";
        break;
    }
    serializeJson(replyDoc, buffer);
    mqttClient.publish(TOPIC_TELEMETRY, buffer);
  }

  // Baca sensor + kontrol relay + publish setiap INTERVAL_BACA ms
  unsigned long now = millis();
  if (now - lastBaca >= INTERVAL_BACA) {
    lastBaca = now;
    bacaSensor();
  }

  // kontrolRelay dipanggil setiap loop (bukan hanya setiap 5 detik)
  // agar state machine timer tetap akurat
  kontrolRelay();

  // Publish data setiap INTERVAL_BACA
  static unsigned long lastPublish = 0;
  bool publishedThisCycle = false;
  if (now - lastPublish >= INTERVAL_BACA) {
    lastPublish = now;
    publishData();
    publishedThisCycle = true;
  }

  // Defer: Simpan threshold ke NVS Flash di luar MQTT callback
  if (pendingPreferencesSave) {
    pendingPreferencesSave = false;
    preferences.putFloat("suhu", suhuThreshold);
    preferences.putFloat("soil", soilThreshold);
    preferences.putFloat("cahaya", cahayaThreshold);
    Serial.printf("[NVS] Tersimpan -> Suhu:%.1f Soil:%.1f Cahaya:%.1f\n", suhuThreshold, soilThreshold, cahayaThreshold);
  }

  // Defer: Publish setelah override — hanya jika belum publish di siklus ini
  // Mencegah double publish yang memboroskan buffer MQTT
  if (pendingPublish && !publishedThisCycle) {
    pendingPublish = false;
    publishData();
  } else {
    pendingPublish = false; // Buang flag jika sudah publish di siklus ini
  }
}
