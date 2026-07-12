#include "MqttHandler.h"
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>

// ============================================================
// Fungsi: toLowercase(const char* src, char* dest, size_t destSize)
// Deskripsi: Mengubah string sumber menjadi huruf kecil semua secara manual (zero-heap)
//            untuk mencocokkan payload JSON dengan entitas nama relay.
// ============================================================
void toLowercase(const char* src, char* dest, size_t destSize) {
  size_t i = 0;
  while (src[i] != '\0' && i < destSize - 1) {
    dest[i] = tolower(src[i]);
    i++;
  }
  dest[i] = '\0';
}
static WiFiManager wm;
static unsigned long lastTimeConnected = 0;

// ============================================================
// Fungsi: setupWiFi()
// Deskripsi: Menghubungkan ESP32 ke jaringan WiFi secara non-blocking / portal.
//            Mencari kredensial di NVS (Flash Memory), jika tidak ada, mencoba config.h,
//            dan jika gagal, akan membuka Captive Portal WiFiManager.
// ============================================================
void setupWiFi() {
  String ssid = "";
  String pass = "";
  bool loadedFromNVS = false;
  bool loadedFromConfig = false;

  // 1. Membaca kredensial Wi-Fi yang tersimpan di NVS (Non-Volatile Storage)
  ssid = preferences.getString("wifi_ssid", "");
  pass = preferences.getString("wifi_pass", "");
  
  if (ssid.length() > 0) {
    loadedFromNVS = true;
  }

  // 2. Jika NVS kosong, gunakan kredensial compile-time dari config.h (sebagai cadangan)
  if (!loadedFromNVS) {
    if (WIFI_SSID != nullptr && strlen(WIFI_SSID) > 0) {
      ssid = WIFI_SSID;
      pass = WIFI_PASSWORD;
      loadedFromConfig = true;
      Serial.printf("[WiFi] Menggunakan kredensial compile-time config.h: SSID='%s'\n", ssid.c_str());
    }
  }

  bool connected = false;
  
  // 3. Mencoba menghubungkan ke Wi-Fi dengan kredensial yang didapatkan
  if (loadedFromNVS || loadedFromConfig) {
    Serial.printf("[WiFi] Mencoba menghubungkan ke SSID: %s\n", ssid.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());
    
    unsigned long startMs = millis();
    // Berikan timeout koneksi selama 15 detik agar tidak memblokir sistem selamanya
    while (WiFi.status() != WL_CONNECTED && millis() - startMs < 15000) {
      delay(500);
      Serial.print(".");
    }
    Serial.println();
    
    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("[WiFi] Terhubung sukses!");
      connected = true;
    } else {
      Serial.println("[WiFi] Gagal menghubungkan ke Wi-Fi.");
    }
  }

  // 4. Jika gagal terhubung, buka Captive Portal AP menggunakan WiFiManager
  bool configPortalUsed = false;
  if (!connected) {
    Serial.println("[WiFi] Membuka portal AP WiFiManager...");
    wm.setConfigPortalBlocking(true); // Pastikan blocking saat setup awal
    wm.setConfigPortalTimeout(180); // Timeout 3 menit agar kembali mencoba offline mode
    
    // Membuka AP dengan SSID "ZENITH-SmartFarm" dan sandi "admin123"
    if (!wm.startConfigPortal("ZENITH-SmartFarm", "admin123")) {
      Serial.println("[WiFi] Gagal konek atau timeout portal.");
    } else {
      Serial.println("[WiFi] Portal terhubung!");
      connected = true;
      configPortalUsed = true;
    }
  }

  // 5. Jika terhubung melalui portal AP, simpan kredensial baru tersebut ke dalam NVS Flash
  if (connected && WiFi.status() == WL_CONNECTED) {
    if (configPortalUsed) {
      String currentSSID = preferences.getString("wifi_ssid", "");
      String currentPass = preferences.getString("wifi_pass", "");
      
      if (currentSSID != WiFi.SSID() || currentPass != WiFi.psk()) {
        preferences.putString("wifi_ssid", WiFi.SSID());
        preferences.putString("wifi_pass", WiFi.psk());
        Serial.printf("[NVS] Kredensial WiFi baru dari Portal disimpan -> SSID: %s\n", WiFi.SSID().c_str());
      }
    }
    Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
  }

  // Inisialisasi lastTimeConnected setelah selesai setup WiFi
  lastTimeConnected = millis();
}

static unsigned long wifiRetryInterval = 5000;
static unsigned long lastWifiAttempt = 0;
static bool portalWasActive = false;

// ============================================================
// Fungsi: jagaWiFi()
// Deskripsi: Mengawasi status koneksi WiFi secara non-blocking.
//            Jika terputus, melakukan rekoneksi berkala menggunakan exponential backoff
//            (melipatgandakan jeda waktu tunggu agar menghemat resource daya alat).
// ============================================================
void jagaWiFi() {
  bool portalIsActive = wm.getConfigPortalActive();
  if (WiFi.status() == WL_CONNECTED) {
    lastTimeConnected = millis();
    wifiRetryInterval = 5000; // Reset kembali jeda waktu tunggu ke 5 detik jika berhasil terhubung
    
    if (portalIsActive) {
      wm.process();
    }
    return;
  }

  // Handle jika portal sedang aktif (non-blocking)
  if (portalIsActive) {
    wm.process();
  } else {
    unsigned long now = millis();
    
    // 1. Lakukan percobaan reconnect berkala (exponential backoff)
  if (now - lastWifiAttempt >= wifiRetryInterval) {
    lastWifiAttempt = now;
    Serial.printf("[WiFi] Terputus. Mencoba reconnect (Interval: %lu ms)...\n", wifiRetryInterval);
    WiFi.reconnect(); // Melakukan koneksi ulang otomatis ke access point terakhir
    
    // Lipat gandakan jeda tunggu hingga maksimal 2 menit (120000 ms)
    wifiRetryInterval = min(wifiRetryInterval * 2, 120000UL);
  }

    // 2. Jika terputus lebih dari 30 detik (30000 ms), buka Captive Portal secara non-blocking
    if (now - lastTimeConnected >= 30000UL) {
      Serial.println("[WiFi] Terputus > 30 detik. Membuka portal AP WiFiManager (Non-blocking)...");
      lastTimeConnected = now; // Reset timer segera untuk menghindari race condition pemanggilan berulang
      wm.setConfigPortalBlocking(false); // Pastikan non-blocking saat runtime
      wm.setConfigPortalTimeout(180);    // Timeout 3 menit
      wm.startConfigPortal("ZENITH-SmartFarm", "admin123");
    }
  }

  // Deteksi transisi jika portal baru saja ditutup atau timeout
  if (portalWasActive && !portalIsActive) {
    Serial.println("[WiFi] Portal AP WiFiManager ditutup/timeout. Melanjutkan reconnect...");
    
    // Sinkronisasi kredensial ke NVS secara aman di sini (hanya dieksekusi sekali saat portal ditutup)
    if (WiFi.status() == WL_CONNECTED) {
      String currentSSID = preferences.getString("wifi_ssid", "");
      String currentPass = preferences.getString("wifi_pass", "");
      if (currentSSID != WiFi.SSID() || currentPass != WiFi.psk()) {
        preferences.putString("wifi_ssid", WiFi.SSID());
        preferences.putString("wifi_pass", WiFi.psk());
        Serial.printf("[NVS] Kredensial WiFi baru disimpan -> SSID: %s\n", WiFi.SSID().c_str());
      }
    }

    lastTimeConnected = millis(); // Reset timer agar tidak langsung membuka portal lagi
    wifiRetryInterval = 5000;    // Reset interval reconnect
  }

  portalWasActive = portalIsActive;
}

static unsigned long mqttRetryInterval = 5000;
static unsigned long lastMqttAttempt = 0;

// ============================================================
// Fungsi: jagaMQTT()
// Deskripsi: Memeriksa dan menjaga koneksi ke broker MQTT HiveMQ secara non-blocking.
//            Jika WiFi terhubung tapi MQTT putus, lakukan rekoneksi berkala (exponential backoff).
// ============================================================
void jagaMQTT() {
  if (mqttClient.connected()) {
    mqttRetryInterval = 5000; // Reset jeda ke 5 detik jika sukses
    return;
  }

  if (WiFi.status() != WL_CONNECTED) return; // Pastikan WiFi terhubung terlebih dahulu

  unsigned long now = millis();
  if (now - lastMqttAttempt >= mqttRetryInterval) {
    lastMqttAttempt = now;
    Serial.printf("[MQTT] Mencoba koneksi ke %s (Interval: %lu ms)...\n", MQTT_SERVER, mqttRetryInterval);
    
    // Mencoba terhubung ke Broker MQTT
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("[MQTT] Terhubung!");
      // Mendaftarkan langganan topik setelah koneksi sukses
      mqttClient.subscribe(TOPIC_CONTROL);
      mqttClient.subscribe(TOPIC_SETTINGS);
      mqttClient.subscribe(TOPIC_OTA);
      Serial.printf("[MQTT] Subscribe: %s, %s, & %s\n", TOPIC_CONTROL, TOPIC_SETTINGS, TOPIC_OTA);
      mqttRetryInterval = 5000; // Reset jeda
    } else {
      Serial.printf("[MQTT] Gagal rc=%d\n", mqttClient.state());
      // Melipatgandakan jeda tunggu rekoneksi (max 2 menit)
      mqttRetryInterval = min(mqttRetryInterval * 2, 120000UL);
    }
  }
}

// ============================================================
// Fungsi: mqttCallback(char* topic, byte* payload, unsigned int length)
// Deskripsi: Callback MQTT yang dipicu secara otomatis ketika ada pesan masuk
//            dari broker pada topik control, settings, atau ota.
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT] Terima | %s\n", topic);

  bool isControl  = strcmp(topic, TOPIC_CONTROL) == 0;
  bool isSettings = strcmp(topic, TOPIC_SETTINGS) == 0;
  bool isOTA      = strcmp(topic, TOPIC_OTA) == 0;
  if (!isControl && !isSettings && !isOTA) return;

  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.printf("[MQTT] JSON error: %s\n", err.c_str());
    return;
  }

  // --- 1. TOPIK CONTROL (Override Relay Manual) ---
  // Menerima perintah untuk mengaktifkan mode manual kipas, pompa, atau lampu.
  if (isControl) {
    for (int i = 0; i < NUM_RELAYS; i++) {
      auto &r = relays[i];
      char nameLower[32];
      toLowercase(r.name, nameLower, sizeof(nameLower));
      
      if (!doc[nameLower].isNull()) {
        // Parsing perintah: 0 = AUTO, 1 = MANUAL ON, 2 = MANUAL OFF
        int cmd = doc[nameLower].is<bool>() ? (doc[nameLower].as<bool>() ? 1 : 0) : doc[nameLower].as<int>();
        *(r.overrideMode) = cmd;
        if (cmd == 1) {
          digitalWrite(r.pin, HIGH);
          r.statusOn = true;
          Serial.printf("[Override] %s: MANUAL ON\n", r.name);
        } else if (cmd == 2) {
          digitalWrite(r.pin, LOW);
          r.statusOn = false;
          Serial.printf("[Override] %s: MANUAL OFF\n", r.name);
        } else {
          digitalWrite(r.pin, LOW);
          r.statusOn = false;
          r.state = RelayState::IDLE;
          r.timerNormal = 0;
          Serial.printf("[Override] %s: AUTO RESUMED\n", r.name);
        }
      }
    }
    // Set flag agar data status terbaru segera dipublikasikan di loop berikutnya
    pendingPublish = true;
  }

  // --- 2. TOPIK SETTINGS (Mengubah Ambang Batas Sensor) ---
  // Mengubah batasan suhu, kelembapan tanah, atau cahaya secara dinamis dari dashboard.
  else if (isSettings) {
    if (!doc["temp"].isNull())  suhuThreshold   = doc["temp"].as<float>();
    if (!doc["hum"].isNull())   soilThreshold   = doc["hum"].as<float>();
    if (!doc["light"].isNull()) cahayaThreshold = doc["light"].as<float>();
    
    // Tandai agar nilai baru ini ditulis ke flash memory (NVS) dan di-publish ke MQTT
    pendingPreferencesSave = true;
    pendingPublish = true;
    Serial.printf("[Settings] Diterima -> Suhu:%.1f Soil:%.1f Cahaya:%.1f\n",
                  suhuThreshold, soilThreshold, cahayaThreshold);
  }

  // --- 3. TOPIK OTA (Melakukan Update Firmware Nirkabel) ---
  // Menerima sinyal beserta URL untuk mendownload biner firmware baru.
  else if (isOTA && (!doc["url"].isNull())) {
    strlcpy(otaTargetUrl, doc["url"].as<const char*>(), sizeof(otaTargetUrl));
    otaTriggered = true; // Set flag pemicu eksekusi update di loop utama
    Serial.printf("[OTA] Perintah update diterima: %s\n", otaTargetUrl);
    
    JsonDocument replyDoc;
    replyDoc["state_ota"] = "MENUNGGU";
    char buffer[64];
    serializeJson(replyDoc, buffer);
    mqttClient.publish(TOPIC_TELEMETRY, buffer);
  }
}

// ============================================================
// Fungsi: getRelayStateString(RelayState state)
// Deskripsi: Mengubah enum RelayState menjadi string representasi text
//            untuk kebutuhan penyusunan payload JSON telemetri MQTT.
// ============================================================
static const char* getRelayStateString(RelayState state) {
  switch (state) {
    case RelayState::IDLE:      return "IDLE";
    case RelayState::TRIGGERED: return "TRIGGERED";
    case RelayState::ON:        return "ON";
    case RelayState::COOLDOWN:  return "COOLDOWN";
    default:                    return "UNKNOWN";
  }
}

// ============================================================
// Fungsi: publishData()
// Deskripsi: Menyusun payload JSON data sensor dan status aktuator
//            lalu mempublikasikannya ke broker MQTT (topik telemetri).
// ============================================================
void publishData() {
  if (!mqttClient.connected()) return; // Batalkan jika MQTT tidak aktif

  JsonDocument doc;
  doc["id"] = DEVICE_ID;
  doc["t"]  = suhu;
  doc["h"]  = humUdara;
  doc["s"]  = tanah;
  doc["l"]  = cahaya;

  // Menambahkan status masing-masing relay ke dokumen JSON
  for (int i = 0; i < NUM_RELAYS; i++) {
    const auto &r = relays[i];
    
    char pfx = 'k'; // default untuk KIPAS
    if (strcmp(r.name, "POMPA") == 0) pfx = 'p';
    else if (strcmp(r.name, "LAMPU") == 0) pfx = 'l';

    char statusKey[3] = { 's', pfx, '\0' }; // Menjadi "sk", "sp", atau "sl" (Status Relay)
    char stateKey[3]  = { 'e', pfx, '\0' }; // Menjadi "ek", "ep", atau "el" (State Relay)
    
    doc[statusKey] = r.statusOn;
    doc[stateKey]  = *(r.overrideMode) != 0 ? "MANUAL" : getRelayStateString(r.state);
  }

  char buffer[256];
  serializeJson(doc, buffer);

  // Kirim data terkompresi JSON ke broker MQTT
  bool ok = mqttClient.publish(TOPIC_TELEMETRY, buffer);
  Serial.printf("[MQTT] Publish %s\n", ok ? "OK" : "GAGAL");
}

// ============================================================
// Fungsi: handleOTA()
// Deskripsi: Mengunduh biner firmware (.bin) baru dari server backend 
//            dan melakukan instalasi pembaruan sistem secara OTA (nirkabel).
//            ESP32 akan melakukan restart otomatis jika update berhasil.
// ============================================================
void handleOTA() {
  otaTriggered = false;
  Serial.println("[OTA] Memulai HTTP Update...");
  
// 1. Publikasikan status download awal
  JsonDocument replyDoc;
  replyDoc["state_ota"] = "MENDOWNLOAD";
  char buffer[256];
  serializeJson(replyDoc, buffer);
  mqttClient.publish(TOPIC_TELEMETRY, buffer);

  // 2. Publikasikan status menginstall tepat sebelum update mengeksekusi restart
  JsonDocument preOtaDoc;
  preOtaDoc["state_ota"] = "MENGINSTALL";
  char preOtaBuf[64];
  serializeJson(preOtaDoc, preOtaBuf);
  mqttClient.publish(TOPIC_TELEMETRY, preOtaBuf);
  mqttClient.loop(); // Pastikan paket terkirim sebelum koneksi terputus
  delay(200);

  t_httpUpdate_return ret;
  
  // 3. Mengeksekusi modul pembaruan HTTP (mendukung HTTP dan HTTPS/SSL)
  if (otaTargetUrl[0] != '\0' && strncmp(otaTargetUrl, "https://", 8) == 0) {
    WiFiClientSecure clientOTASecure;
    clientOTASecure.setInsecure(); // Mengabaikan validasi rantai sertifikat SSL demi performa
    ret = httpUpdate.update(clientOTASecure, otaTargetUrl);
  } else {
    WiFiClient clientOTA;
    ret = httpUpdate.update(clientOTA, otaTargetUrl);
  }

  // 4. Memeriksa hasil pembaruan jika tidak terjadi restart otomatis (kasus gagal/tidak ada update)
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
  
  // Publikasikan laporan status akhir kegagalan/tidak adanya update
  serializeJson(replyDoc, buffer);
  mqttClient.publish(TOPIC_TELEMETRY, buffer);
}
