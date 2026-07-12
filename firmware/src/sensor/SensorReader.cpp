#include "SensorReader.h"
#include <DHT.h>

static DHT dht(DHTPIN, DHTTYPE);

void initSensors() {
  dht.begin();
}

void bacaSensor() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (!isnan(t)) suhu     = t;
  if (!isnan(h)) humUdara = h;

  // Soil Moisture — average 4 samples to dampen ESP32 ADC noise
  long rawSoilSum = 0;
  for (int i = 0; i < 4; i++) rawSoilSum += analogRead(SOIL_PIN);
  int rawSoil = (int)(rawSoilSum / 4);
  float fTanah = (float)(rawSoil - SOIL_KERING) * 100.0f / (float)(SOIL_BASAH - SOIL_KERING);
  tanah = constrain(fTanah, 0.0f, 100.0f);

  // LDR Light — average 4 samples to dampen ESP32 ADC noise
  long rawLDRSum = 0;
  for (int i = 0; i < 4; i++) rawLDRSum += analogRead(LDR_PIN);
  int rawLDR = (int)(rawLDRSum / 4);
  float fCahaya = (float)(rawLDR - LDR_GELAP) * 100.0f / (float)(LDR_TERANG - LDR_GELAP);
  cahaya = constrain(fCahaya, 0.0f, 100.0f);

  Serial.printf("[Sensor] Suhu:%.1f°C | Hum:%.1f%% | Tanah:%.1f%% | Cahaya:%.1f%%\n",
                suhu, humUdara, tanah, cahaya);
}
