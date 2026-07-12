#include "RelayController.h"

// ============================================================
// Fungsi: updateRelay(RelayEntity &rc)
// Deskripsi: State Machine untuk mengontrol masing-masing relay aktuator (Kipas, Pompa, Lampu).
//            Menggunakan debounce & cooldown non-blocking timer agar alat bekerja aman dan presisi.
//            
// Alur State:
// IDLE (Memantau) -> TRIGGERED (Syarat terpenuhi, hitung trigger) -> ON (Relay Aktif) -> COOLDOWN (Batas aktif selesai, masa istirahat)
// ============================================================
void updateRelay(RelayEntity &rc) {
  unsigned long now = millis();

  // --- LOGIKA OVERRIDE MANUAL ---
  // Jika mode override aktif dari MQTT dashboard (1 = Manual ON, 2 = Manual OFF),
  // lewati (bypass) seluruh logika otomatis state machine di bawah.
  if (*(rc.overrideMode) != 0) return;

  // Cek apakah kondisi sensor memenuhi batas ambang/threshold (misal: suhu > threshold)
  bool kondisiTerpenuhi = rc.checkCondition();

  switch (rc.state) {
    // --- STATE: IDLE (Biasa/Normal) ---
    // Memantau kondisi sensor secara berkala. Jika buruk, masuk ke state TRIGGERED untuk bersiap aktif.
    case RelayState::IDLE:
      if (kondisiTerpenuhi) {
        rc.state      = RelayState::TRIGGERED;
        rc.timerMulai = now;
        Serial.printf("[%s] Kondisi terpenuhi, mulai hitung %lu detik...\n", rc.name, DURASI_TRIGGER / 1000);
      }
      break;

    // --- STATE: TRIGGERED (Debounce On) ---
    // Memastikan kondisi buruk bertahan stabil selama DURASI_TRIGGER (misal 6 detik)
    // agar relay tidak mudah menyala-mati akibat fluktuasi/noise sesaat pada pembacaan sensor.
    case RelayState::TRIGGERED:
      if (!kondisiTerpenuhi) {
        // Jika kondisi kembali normal sebelum target durasi tercapai, batalkan dan kembali ke IDLE
        rc.state = RelayState::IDLE;
        Serial.printf("[%s] Kondisi tidak bertahan, reset ke IDLE\n", rc.name);
      } else if (now - rc.timerMulai >= DURASI_TRIGGER) {
        // Jika kondisi buruk bertahan terus-menerus selama durasi trigger, aktifkan relay.
        digitalWrite(rc.pin, HIGH);
        rc.statusOn    = true;
        rc.state       = RelayState::ON;
        rc.timerMulai  = now;
        rc.timerNormal = 0; // Reset timer off-debounce
        Serial.printf("[%s] %lu detik terpenuhi → RELAY ON\n", rc.name, DURASI_TRIGGER / 1000);
      }
      break;

    // --- STATE: ON (Relay Aktif) ---
    // Relay menyala selama durasi minimal tertentu untuk mencegah mesin/alat cepat rusak akibat siklus pendek (short cycling).
    // Setelah durasi minimal terlewati, jika kondisi sensor sudah normal kembali, relay akan dimatikan setelah melalui off-debounce.
    case RelayState::ON:
      if (now - rc.timerMulai >= rc.durasiOn) {
        if (!kondisiTerpenuhi) {
          if (rc.timerNormal == 0) {
            rc.timerNormal = now; // Mulai menghitung off-debounce (memastikan kondisi benar-benar normal stabil)
            Serial.printf("[%s] Kondisi terdeteksi normal, memulai off-debounce...\n", rc.name);
          } else if (now - rc.timerNormal >= DURASI_TRIGGER) {
            // Jika kondisi normal bertahan stabil, matikan relay dan masuk ke masa COOLDOWN
            digitalWrite(rc.pin, LOW);
            rc.statusOn   = false;
            rc.state      = RelayState::COOLDOWN;
            rc.timerMulai = now;
            rc.timerNormal = 0;
            Serial.printf("[%s] Kondisi normal stabil → RELAY OFF → cooldown\n", rc.name);
          }
        } else {
          // Jika kondisi kembali memburuk, batalkan penghitungan timer off-debounce
          if (rc.timerNormal != 0) {
            rc.timerNormal = 0;
            Serial.printf("[%s] Kondisi buruk kembali, membatalkan off-debounce\n", rc.name);
          }
        }
      }
      break;

    // --- STATE: COOLDOWN (Masa Istirahat Perangkat) ---
    // Setelah mati, paksa perangkat untuk istirahat selama DURASI_COOLDOWN (misal 10 detik)
    // sebelum diperbolehkan menyala kembali untuk menghindari beban berlebih (overload) pada perangkat keras.
    case RelayState::COOLDOWN:
      if (now - rc.timerMulai >= DURASI_COOLDOWN) {
        rc.state = RelayState::IDLE; // Cooldown selesai, kembali siap memantau sensor (IDLE)
        Serial.printf("[%s] Cooldown selesai → kembali IDLE\n", rc.name);
      }
      break;
  }
}

// ============================================================
// Fungsi: kontrolRelay()
// Deskripsi: Melakukan perulangan (looping) untuk memperbarui status mesin kendali (state machine) 
//            pada semua relay yang terdaftar di sistem.
// ============================================================
void kontrolRelay() {
  for (int i = 0; i < NUM_RELAYS; i++) {
    updateRelay(relays[i]);
  }
}
