#include "SensorReader.h"
#include <DHT.h>

// Deklarasi objek DHT sensor secara statis menggunakan pin dan tipe dari globals
static DHT dht(DHTPIN, DHTTYPE);

// ============================================================
// Fungsi: initSensors()
// Deskripsi: Menginisialisasi sensor DHT22 untuk siap membaca suhu dan kelembapan.
// ============================================================
void initSensors() {
  dht.begin();
}

// ============================================================
// Fungsi: bacaSensor()
// Deskripsi: Membaca data dari sensor DHT22, LDR (cahaya), dan Soil Moisture (kelembapan tanah).
//            Menggunakan teknik rata-rata (oversampling) untuk meredam noise ADC ESP32.
// ============================================================
void bacaSensor() {
  // Membaca suhu dan kelembapan dari DHT22
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  
  // Jika pembacaan valid (bukan NaN), update variabel global shared
  if (!isnan(t)) suhu     = t;
  if (!isnan(h)) humUdara = h;

  // --- Pembacaan Sensor Kelembapan Tanah ---
  // Mengambil 4 sampel ADC untuk meredam noise tegangan pada ESP32
  long rawSoilSum = 0;
  for (int i = 0; i < 4; i++) rawSoilSum += analogRead(SOIL_PIN);
  int rawSoil = (int)(rawSoilSum / 4);
  
  // Konversi nilai ADC mentah ke persentase (%) berdasarkan nilai kalibrasi basah dan kering
  float fTanah = (float)(rawSoil - SOIL_KERING) * 100.0f / (float)(SOIL_BASAH - SOIL_KERING);
  tanah = constrain(fTanah, 0.0f, 100.0f); // Membatasi nilai agar selalu berada di rentang 0-100%

  // --- Pembacaan Sensor LDR (Cahaya) ---
  // Mengambil 4 sampel ADC untuk meredam noise pembacaan sensor cahaya
  long rawLDRSum = 0;
  for (int i = 0; i < 4; i++) rawLDRSum += analogRead(LDR_PIN);
  int rawLDR = (int)(rawLDRSum / 4);
  
  // Konversi nilai ADC mentah ke persentase (%) berdasarkan batas kalibrasi terang dan gelap
  float fCahaya = (float)(rawLDR - LDR_GELAP) * 100.0f / (float)(LDR_TERANG - LDR_GELAP);
  cahaya = constrain(fCahaya, 0.0f, 100.0f); // Membatasi nilai agar selalu berada di rentang 0-100%

  // Mencetak hasil pembacaan sensor ke Serial Monitor untuk keperluan debugging
  Serial.printf("[Sensor] Suhu:%.1f°C | Hum:%.1f%% | Tanah:%.1f%% | Cahaya:%.1f%%\n",
                suhu, humUdara, tanah, cahaya);
}
