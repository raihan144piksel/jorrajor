#include "MqttHandler.h"
#include <WiFiManager.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>

// Zero-heap string utility helper implementation
void toLowercase(const char* src, char* dest, size_t destSize) {
  size_t i = 0;
  while (src[i] != '\0' && i < destSize - 1) {
    dest[i] = tolower(src[i]);
    i++;
  }
  dest[i] = '\0';
}

void setupWiFi() {
  String ssid = "";
  String pass = "";
  bool loadedFromNVS = false;
  bool loadedFromConfig = false;

  // 1. Read Wi-Fi settings from NVS
  ssid = preferences.getString("wifi_ssid", "");
  pass = preferences.getString("wifi_pass", "");
  
  if (ssid.length() > 0) {
    loadedFromNVS = true;
  }

  // 2. Fallback to compile-time variables from config.h if NVS is empty
  if (!loadedFromNVS) {
    if (WIFI_SSID != nullptr && strlen(WIFI_SSID) > 0) {
      ssid = WIFI_SSID;
      pass = WIFI_PASSWORD;
      loadedFromConfig = true;
      Serial.printf("[WiFi] Menggunakan kredensial compile-time config.h: SSID='%s'\n", ssid.c_str());
    }
  }

  bool connected = false;
  
  // 3. Attempt connecting to Wi-Fi if credentials exist
  if (loadedFromNVS || loadedFromConfig) {
    Serial.printf("[WiFi] Mencoba menghubungkan ke SSID: %s\n", ssid.c_str());
    WiFi.mode(WIFI_STA);
    WiFi.begin(ssid.c_str(), pass.c_str());
    
    unsigned long startMs = millis();
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

  // 4. Open AP portal if not connected
  bool configPortalUsed = false;
  if (!connected) {
    Serial.println("[WiFi] Membuka portal AP WiFiManager...");
    WiFiManager wm;
    wm.setConfigPortalTimeout(180);
    
    if (!wm.startConfigPortal("SEMAI-SmartFarm", "admin123")) {
      Serial.println("[WiFi] Gagal konek atau timeout portal.");
    } else {
      Serial.println("[WiFi] Portal terhubung!");
      connected = true;
      configPortalUsed = true;
    }
  }

  // 5. Synchronize connected credentials back to NVS ONLY if configured via Portal
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
}

static unsigned long wifiRetryInterval = 5000;
static unsigned long lastWifiAttempt = 0;

void jagaWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    wifiRetryInterval = 5000; // Reset backoff on success
    return;
  }

  unsigned long now = millis();
  if (now - lastWifiAttempt >= wifiRetryInterval) {
    lastWifiAttempt = now;
    Serial.printf("[WiFi] Terputus. Mencoba reconnect (Interval: %lu ms)...\n", wifiRetryInterval);
    WiFi.reconnect();
    
    // Exponential backoff up to 2 minutes (120000 ms)
    wifiRetryInterval = min(wifiRetryInterval * 2, 120000UL);
  }
}

static unsigned long mqttRetryInterval = 5000;
static unsigned long lastMqttAttempt = 0;

void jagaMQTT() {
  if (mqttClient.connected()) {
    mqttRetryInterval = 5000; // Reset backoff on success
    return;
  }

  if (WiFi.status() != WL_CONNECTED) return; // Wait for WiFi first

  unsigned long now = millis();
  if (now - lastMqttAttempt >= mqttRetryInterval) {
    lastMqttAttempt = now;
    Serial.printf("[MQTT] Mencoba koneksi ke %s (Interval: %lu ms)...\n", MQTT_SERVER, mqttRetryInterval);
    
    if (mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("[MQTT] Terhubung!");
      mqttClient.subscribe(TOPIC_CONTROL);
      mqttClient.subscribe(TOPIC_SETTINGS);
      mqttClient.subscribe(TOPIC_OTA);
      Serial.printf("[MQTT] Subscribe: %s, %s, & %s\n", TOPIC_CONTROL, TOPIC_SETTINGS, TOPIC_OTA);
      mqttRetryInterval = 5000; // Reset backoff
    } else {
      Serial.printf("[MQTT] Gagal rc=%d\n", mqttClient.state());
      // Exponential backoff up to 2 minutes (120000 ms)
      mqttRetryInterval = min(mqttRetryInterval * 2, 120000UL);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT] Terima | %s\n", topic);

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

  if (isControl) {
    for (int i = 0; i < NUM_RELAYS; i++) {
      auto &r = relays[i];
      char nameLower[32];
      toLowercase(r.name, nameLower, sizeof(nameLower));
      
      if (doc.containsKey(nameLower)) {
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
    pendingPublish = true;
  }

  else if (isSettings) {
    if (doc.containsKey("temp"))  suhuThreshold   = doc["temp"].as<float>();
    if (doc.containsKey("hum"))   soilThreshold   = doc["hum"].as<float>();
    if (doc.containsKey("light")) cahayaThreshold = doc["light"].as<float>();
    pendingPreferencesSave = true;
    pendingPublish = true;
    Serial.printf("[Settings] Diterima -> Suhu:%.1f Soil:%.1f Cahaya:%.1f\n",
                  suhuThreshold, soilThreshold, cahayaThreshold);
  }

  else if (isOTA && doc.containsKey("url")) {
    strlcpy(otaTargetUrl, doc["url"].as<const char*>(), sizeof(otaTargetUrl));
    otaTriggered = true;
    Serial.printf("[OTA] Perintah update diterima: %s\n", otaTargetUrl);
    
    StaticJsonDocument<64> replyDoc;
    replyDoc["state_ota"] = "MENUNGGU";
    char buffer[64];
    serializeJson(replyDoc, buffer);
    mqttClient.publish(TOPIC_TELEMETRY, buffer);
  }
}

static const char* getRelayStateString(RelayState state) {
  switch (state) {
    case RelayState::IDLE:      return "IDLE";
    case RelayState::TRIGGERED: return "TRIGGERED";
    case RelayState::ON:        return "ON";
    case RelayState::COOLDOWN:  return "COOLDOWN";
    default:                    return "UNKNOWN";
  }
}

void publishData() {
  if (!mqttClient.connected()) return;

  JsonDocument doc;
  doc["id"] = DEVICE_ID;
  doc["t"]  = suhu;
  doc["h"]  = humUdara;
  doc["s"]  = tanah;
  doc["l"]  = cahaya;

  for (int i = 0; i < NUM_RELAYS; i++) {
    const auto &r = relays[i];
    
    char pfx = 'k'; // default for KIPAS
    if (strcmp(r.name, "POMPA") == 0) pfx = 'p';
    else if (strcmp(r.name, "LAMPU") == 0) pfx = 'l';

    char statusKey[3] = { 's', pfx, '\0' }; // e.g. "sk", "sp", "sl"
    char stateKey[3]  = { 'e', pfx, '\0' }; // e.g. "ek", "ep", "el"
    
    doc[statusKey] = r.statusOn;
    doc[stateKey]  = *(r.overrideMode) != 0 ? "MANUAL" : getRelayStateString(r.state);
  }

  char buffer[256];
  serializeJson(doc, buffer);

  bool ok = mqttClient.publish(TOPIC_TELEMETRY, buffer);
  Serial.printf("[MQTT] Publish %s\n", ok ? "OK" : "GAGAL");
}

void handleOTA() {
  otaTriggered = false;
  Serial.println("[OTA] Memulai HTTP Update...");
  
  StaticJsonDocument<256> replyDoc;
  replyDoc["state_ota"] = "MENDOWNLOAD";
  char buffer[256];
  serializeJson(replyDoc, buffer);
  mqttClient.publish(TOPIC_TELEMETRY, buffer);

  StaticJsonDocument<64> preOtaDoc;
  preOtaDoc["state_ota"] = "MENGINSTALL";
  char preOtaBuf[64];
  serializeJson(preOtaDoc, preOtaBuf);
  mqttClient.publish(TOPIC_TELEMETRY, preOtaBuf);
  mqttClient.loop();
  delay(200);

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
