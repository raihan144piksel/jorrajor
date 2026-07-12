#ifndef RELAY_CONTROLLER_H
#define RELAY_CONTROLLER_H

#include "../globals.h"

// ============================================================
// Fungsi: updateRelay(RelayEntity &rc)
// Deskripsi: State Machine untuk mengontrol masing-masing relay aktuator (Kipas, Pompa, Lampu).
//            Menggunakan debounce & cooldown non-blocking timer agar alat bekerja aman dan presisi.
// Parameter:
//   - rc: Referensi ke objek RelayEntity yang akan diperbarui
// ============================================================
void updateRelay(RelayEntity &rc);

// ============================================================
// Fungsi: kontrolRelay()
// Deskripsi: Melakukan perulangan (looping) untuk memperbarui status mesin kendali (state machine) 
//            pada semua relay yang terdaftar di sistem.
// ============================================================
void kontrolRelay();

#endif
