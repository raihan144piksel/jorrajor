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

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
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
//  THRESHOLD
// ─────────────────────────────────────────────
#define SUHU_THRESHOLD   30.0   // °C  — kipas ON jika suhu > nilai ini
#define SOIL_THRESHOLD   40.0   // %   — pompa ON jika tanah < nilai ini
#define CAHAYA_THRESHOLD 50.0   // %   — lampu ON jika cahaya < nilai ini

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
const unsigned long INTERVAL_BACA    = 5000;    // baca sensor setiap 5 detik
const unsigned long DURASI_TRIGGER   = 10000;   // kondisi harus bertahan 10 detik → relay ON
const unsigned long DURASI_ON_POMPA  = 15000;   // pompa menyala minimal 15 detik
const unsigned long DURASI_ON_KIPAS  = 45000;   // kipas menyala minimal 45 detik
const unsigned long DURASI_ON_LAMPU  = 60000;   // lampu menyala minimal 60 detik
const unsigned long DURASI_COOLDOWN  = 120000;  // cooldown 120 detik setelah relay mati

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
};

// ─────────────────────────────────────────────
//  OBJEK
// ─────────────────────────────────────────────
DHT          dht(DHTPIN, DHTTYPE);
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

// ─────────────────────────────────────────────
//  DATA RELAY
// ─────────────────────────────────────────────
RelayControl rcPompa = { STATE_IDLE, 0, DURASI_ON_POMPA, false };
RelayControl rcKipas = { STATE_IDLE, 0, DURASI_ON_KIPAS, false };
RelayControl rcLampu = { STATE_IDLE, 0, DURASI_ON_LAMPU, false };

// ─────────────────────────────────────────────
//  VARIABEL SENSOR & STATUS
// ─────────────────────────────────────────────
float suhu     = 0;
float humUdara = 0;
float tanah    = 0;
float cahaya   = 0;

bool overrideKipas = false;
bool overridePompa = false;
bool overrideLampu = false;

bool statusKipas = false;
bool statusPompa = false;
bool statusLampu = false;

// Anti-spam Telegram — hanya kirim notif saat state berubah ON
bool notifKipas = false;
bool notifPompa = false;
bool notifLampu = false;

unsigned long lastBaca = 0;


// ═══════════════════════════════════════════════════════
//  TELEGRAM — Kirim notifikasi via HTTPClient
// ═══════════════════════════════════════════════════════
void kirimTelegram(String pesan) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = "https://api.telegram.org/bot";
  url += TG_TOKEN;
  url += "/sendMessage?chat_id=";
  url += TG_CHAT_ID;
  url += "&text=";

  // Encode spasi dan karakter khusus
  pesan.replace(" ", "%20");
  pesan.replace("\n", "%0A");
  url += pesan;

  http.begin(url);
  int code = http.GET();
  Serial.printf("[Telegram] HTTP %d\n", code);
  http.end();
}


// ═══════════════════════════════════════════════════════
//  WIFI — Koneksi & reconnect
// ═══════════════════════════════════════════════════════
void koneksiWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("\n[WiFi] Menghubungkan ke: %s\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.printf("\n[WiFi] Terhubung! IP: %s\n", WiFi.localIP().toString().c_str());
}


// ═══════════════════════════════════════════════════════
//  MQTT CALLBACK — terima perintah override dari dashboard
//  Payload JSON: {"kipas":true} / {"pompa":false} / dll
// ═══════════════════════════════════════════════════════
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String pesan = "";
  for (unsigned int i = 0; i < length; i++) pesan += (char)payload[i];
  Serial.printf("[MQTT] Terima | %s | %s\n", topic, pesan.c_str());

  StaticJsonDocument<200> doc;
  DeserializationError err = deserializeJson(doc, pesan);
  if (err) {
    Serial.printf("[MQTT] JSON error: %s\n", err.c_str());
    return;
  }

  // Override langsung nyalakan/matikan relay, abaikan timer
  if (doc.containsKey("kipas")) {
    overrideKipas = doc["kipas"].as<bool>();
    if (overrideKipas) {
      digitalWrite(RELAY_KIPAS, HIGH);
      rcKipas.statusOn = true;
      Serial.println("[Override] Kipas: MANUAL ON");
    } else {
      digitalWrite(RELAY_KIPAS, LOW);
      rcKipas.statusOn  = false;
      rcKipas.state     = STATE_COOLDOWN;
      rcKipas.timerMulai = millis();
      Serial.println("[Override] Kipas: MANUAL OFF → cooldown");
    }
  }
  if (doc.containsKey("pompa")) {
    overridePompa = doc["pompa"].as<bool>();
    if (overridePompa) {
      digitalWrite(RELAY_POMPA, HIGH);
      rcPompa.statusOn = true;
      Serial.println("[Override] Pompa: MANUAL ON");
    } else {
      digitalWrite(RELAY_POMPA, LOW);
      rcPompa.statusOn   = false;
      rcPompa.state      = STATE_COOLDOWN;
      rcPompa.timerMulai = millis();
      Serial.println("[Override] Pompa: MANUAL OFF → cooldown");
    }
  }
  if (doc.containsKey("lampu")) {
    overrideLampu = doc["lampu"].as<bool>();
    if (overrideLampu) {
      digitalWrite(RELAY_LAMPU, HIGH);
      rcLampu.statusOn = true;
      Serial.println("[Override] Lampu: MANUAL ON");
    } else {
      digitalWrite(RELAY_LAMPU, LOW);
      rcLampu.statusOn   = false;
      rcLampu.state      = STATE_COOLDOWN;
      rcLampu.timerMulai = millis();
      Serial.println("[Override] Lampu: MANUAL OFF → cooldown");
    }
  }
}


// ═══════════════════════════════════════════════════════
//  MQTT — Koneksi & reconnect + subscribe
// ═══════════════════════════════════════════════════════
void koneksiMQTT() {
  while (!mqttClient.connected()) {
    Serial.printf("[MQTT] Konek ke %s...\n", MQTT_SERVER);
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("[MQTT] Terhubung!");
      mqttClient.subscribe(TOPIC_CONTROL);
      Serial.printf("[MQTT] Subscribe: %s\n", TOPIC_CONTROL);
    } else {
      Serial.printf("[MQTT] Gagal rc=%d, coba lagi 3 detik...\n", mqttClient.state());
      delay(3000);
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

  // Soil Moisture
  int rawSoil = analogRead(SOIL_PIN);
  tanah = constrain(map(rawSoil, SOIL_KERING, SOIL_BASAH, 0, 100), 0, 100);

  // LDR Cahaya
  int rawLDR = analogRead(LDR_PIN);
  cahaya = constrain(map(rawLDR, LDR_GELAP, LDR_TERANG, 0, 100), 0, 100);

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
                 bool overrideOn, bool &notifFlag,
                 const char* namaRelay, String pesanNotif) {

  unsigned long now = millis();

  // ── Override aktif: bypass semua state machine ──────
  // (relay sudah di-handle langsung di callback MQTT)
  if (overrideOn) return;

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
        // 10 detik terpenuhi → nyalakan relay
        digitalWrite(pin, HIGH);
        rc.statusOn   = true;
        rc.state      = STATE_ON;
        rc.timerMulai = now;
        Serial.printf("[%s] 10 detik terpenuhi → RELAY ON\n", namaRelay);

        if (!notifFlag) {
          kirimTelegram(pesanNotif);
          notifFlag = true;
        }
      }
      break;

    // ── ON: relay menyala, tunggu durasi minimal selesai ──
    case STATE_ON:
      if (now - rc.timerMulai >= rc.durasiOn) {
        // Durasi minimal tercapai
        if (!kondisiTerpenuhi) {
          // Kondisi sudah normal → matikan relay, masuk cooldown
          digitalWrite(pin, LOW);
          rc.statusOn   = false;
          rc.state      = STATE_COOLDOWN;
          rc.timerMulai = now;
          notifFlag     = false;
          Serial.printf("[%s] Kondisi normal → RELAY OFF → cooldown 120 detik\n", namaRelay);
        }
        // Kalau kondisi masih buruk, relay tetap ON (tidak masuk cooldown)
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
  // Kipas — kondisi: suhu > 30°C
  updateRelay(
    rcKipas, RELAY_KIPAS,
    (suhu > SUHU_THRESHOLD),
    overrideKipas, notifKipas,
    "KIPAS",
    "Kipas ON\nAlasan: Suhu " + String(suhu, 1) + "C > " + String(SUHU_THRESHOLD, 0) + "C selama 10 detik"
  );

  // Pompa — kondisi: tanah < 40%
  updateRelay(
    rcPompa, RELAY_POMPA,
    (tanah < SOIL_THRESHOLD),
    overridePompa, notifPompa,
    "POMPA",
    "Pompa Air ON\nAlasan: Tanah " + String(tanah, 1) + "% < " + String(SOIL_THRESHOLD, 0) + "% selama 10 detik"
  );

  // Lampu — kondisi: cahaya < 50%
  updateRelay(
    rcLampu, RELAY_LAMPU,
    (cahaya < CAHAYA_THRESHOLD),
    overrideLampu, notifLampu,
    "LAMPU",
    "Lampu LED ON\nAlasan: Cahaya " + String(cahaya, 1) + "% < " + String(CAHAYA_THRESHOLD, 0) + "% selama 10 detik"
  );
}


// ═══════════════════════════════════════════════════════
//  PUBLISH DATA KE MQTT
// ═══════════════════════════════════════════════════════
void publishData() {
  // Label state untuk info di dashboard
  const char* stateLabel[] = { "IDLE", "TRIGGERED", "ON", "COOLDOWN" };

  StaticJsonDocument<400> doc;
  doc["suhu"]             = suhu;
  doc["kelembapan_udara"] = humUdara;
  doc["tanah"]            = tanah;
  doc["cahaya"]           = cahaya;
  doc["status_kipas"]     = rcKipas.statusOn;
  doc["status_pompa"]     = rcPompa.statusOn;
  doc["status_lampu"]     = rcLampu.statusOn;
  doc["state_kipas"]      = stateLabel[rcKipas.state];
  doc["state_pompa"]      = stateLabel[rcPompa.state];
  doc["state_lampu"]      = stateLabel[rcLampu.state];

  char buffer[400];
  serializeJson(doc, buffer);

  bool ok = mqttClient.publish(TOPIC_TELEMETRY, buffer);
  Serial.printf("[MQTT] Publish %s → %s\n", ok ? "OK" : "GAGAL", buffer);
}


// ═══════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== ESP32 Smart Farm v3.0 ===");

  // Init relay — semua OFF dulu
  pinMode(RELAY_POMPA, OUTPUT);
  pinMode(RELAY_KIPAS, OUTPUT);
  pinMode(RELAY_LAMPU, OUTPUT);
  digitalWrite(RELAY_POMPA, LOW);
  digitalWrite(RELAY_KIPAS, LOW);
  digitalWrite(RELAY_LAMPU, LOW);

  dht.begin();

  // Koneksi WiFi (loop sampai terhubung)
  koneksiWiFi();

  // Setup & koneksi MQTT (loop sampai terhubung)
  espClient.setInsecure();
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  koneksiMQTT();

  Serial.println("[System] Siap!\n");
}


// ═══════════════════════════════════════════════════════
//  LOOP UTAMA — tanpa delay(), pakai millis()
// ═══════════════════════════════════════════════════════
void loop() {
  // Jaga koneksi WiFi
  koneksiWiFi();

  // Jaga koneksi MQTT
  if (!mqttClient.connected()) koneksiMQTT();
  mqttClient.loop();  // proses pesan masuk (callback)

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
  if (now - lastPublish >= INTERVAL_BACA) {
    lastPublish = now;
    publishData();
  }
}
