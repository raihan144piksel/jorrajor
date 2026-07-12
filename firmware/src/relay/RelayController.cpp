#include "RelayController.h"

void updateRelay(RelayEntity &rc) {
  unsigned long now = millis();

  // Override active: bypass auto state machine
  if (*(rc.overrideMode) != 0) return;

  bool kondisiTerpenuhi = rc.checkCondition();

  switch (rc.state) {
    case RelayState::IDLE:
      if (kondisiTerpenuhi) {
        rc.state      = RelayState::TRIGGERED;
        rc.timerMulai = now;
        Serial.printf("[%s] Kondisi terpenuhi, mulai hitung %lu detik...\n", rc.name, DURASI_TRIGGER / 1000);
      }
      break;

    case RelayState::TRIGGERED:
      if (!kondisiTerpenuhi) {
        rc.state = RelayState::IDLE;
        Serial.printf("[%s] Kondisi tidak bertahan, reset ke IDLE\n", rc.name);
      } else if (now - rc.timerMulai >= DURASI_TRIGGER) {
        digitalWrite(rc.pin, HIGH);
        rc.statusOn    = true;
        rc.state       = RelayState::ON;
        rc.timerMulai  = now;
        rc.timerNormal = 0;
        Serial.printf("[%s] %lu detik terpenuhi → RELAY ON\n", rc.name, DURASI_TRIGGER / 1000);
      }
      break;

    case RelayState::ON:
      if (now - rc.timerMulai >= rc.durasiOn) {
        if (!kondisiTerpenuhi) {
          if (rc.timerNormal == 0) {
            rc.timerNormal = now;
            Serial.printf("[%s] Kondisi terdeteksi normal, memulai off-debounce...\n", rc.name);
          } else if (now - rc.timerNormal >= DURASI_TRIGGER) {
            digitalWrite(rc.pin, LOW);
            rc.statusOn   = false;
            rc.state      = RelayState::COOLDOWN;
            rc.timerMulai = now;
            rc.timerNormal = 0;
            Serial.printf("[%s] Kondisi normal stabil → RELAY OFF → cooldown\n", rc.name);
          }
        } else {
          if (rc.timerNormal != 0) {
            rc.timerNormal = 0;
            Serial.printf("[%s] Kondisi buruk kembali, membatalkan off-debounce\n", rc.name);
          }
        }
      }
      break;

    case RelayState::COOLDOWN:
      if (now - rc.timerMulai >= DURASI_COOLDOWN) {
        rc.state = RelayState::IDLE;
        Serial.printf("[%s] Cooldown selesai → kembali IDLE\n", rc.name);
      }
      break;
  }
}

void kontrolRelay() {
  for (int i = 0; i < NUM_RELAYS; i++) {
    updateRelay(relays[i]);
  }
}
