#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include "../globals.h"

// ============================================================
// Fungsi: setupWiFi()
// Deskripsi: Menghubungkan ESP32 ke jaringan WiFi secara non-blocking / portal.
//            Mencari kredensial di NVS (Flash Memory), jika tidak ada, mencoba config.h,
//            dan jika gagal, akan membuka Captive Portal WiFiManager.
// ============================================================
void setupWiFi();

// ============================================================
// Fungsi: jagaWiFi()
// Deskripsi: Mengawasi status koneksi WiFi secara non-blocking.
//            Jika terputus, melakukan rekoneksi berkala menggunakan exponential backoff
//            (melipatgandakan jeda waktu tunggu agar menghemat resource daya alat).
// ============================================================
void jagaWiFi();

// ============================================================
// Fungsi: jagaMQTT()
// Deskripsi: Memeriksa dan menjaga koneksi ke broker MQTT HiveMQ secara non-blocking.
//            Jika WiFi terhubung tapi MQTT putus, lakukan rekoneksi berkala (exponential backoff).
// ============================================================
void jagaMQTT();

// ============================================================
// Fungsi: mqttCallback(char* topic, byte* payload, unsigned int length)
// Deskripsi: Callback MQTT yang dipicu secara otomatis ketika ada pesan masuk
//            dari broker pada topik control, settings, atau ota.
// Parameter:
//   - topic: Nama topik MQTT dari mana pesan diterima
//   - payload: Data byte/isi pesan yang diterima
//   - length: Panjang isi pesan dalam byte
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length);

// ============================================================
// Fungsi: publishData()
// Deskripsi: Menyusun payload JSON data sensor dan status aktuator
//            lalu mempublikasikannya ke broker MQTT (topik telemetri).
// ============================================================
void publishData();

// ============================================================
// Fungsi: handleOTA()
// Deskripsi: Mengunduh biner firmware (.bin) baru dari server backend 
//            dan melakukan instalasi pembaruan sistem secara OTA (nirkabel).
//            ESP32 akan melakukan restart otomatis jika update berhasil.
// ============================================================
void handleOTA();

#endif
