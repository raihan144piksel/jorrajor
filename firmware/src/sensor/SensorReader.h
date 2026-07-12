#ifndef SENSOR_READER_H
#define SENSOR_READER_H

#include "../globals.h"

// ============================================================
// Fungsi: initSensors()
// Deskripsi: Menginisialisasi sensor DHT22 untuk siap membaca suhu dan kelembapan.
// ============================================================
void initSensors();

// ============================================================
// Fungsi: bacaSensor()
// Deskripsi: Membaca data dari sensor DHT22, LDR (cahaya), dan Soil Moisture (kelembapan tanah).
//            Menggunakan teknik rata-rata (oversampling) untuk meredam noise ADC ESP32.
// ============================================================
void bacaSensor();

#endif
