# 🔌 API & MQTT Reference

Sistem SEMAI Smart Farm menggunakan REST API (untuk dashboard) dan protokol MQTT (untuk komunikasi real-time dengan perangkat IoT ESP32) serta Open-Meteo API (untuk ramalan cuaca).

---

## 🌐 REST API Reference

Semua endpoint kecuali `/api/login` dilindungi oleh middleware autentikasi. Gunakan header: `Authorization: Bearer <your_token>`.

### Authentication

- `POST /api/login`: Login pengguna untuk mendapatkan token JWT (`username` & `password`).
- `GET /api/login-logs`: Mendapatkan riwayat log percobaan masuk (login) beserta alamat IP.

### Telemetry & Analytics

- `GET /api/telemetry?range=30m&bin=none&device_id=device0`: Mendapatkan data sensor murni atau teragregasi berdasarkan `device_id`.
- `GET /api/telemetry/table?page=1&limit=50&device_id=device0`: Mendapatkan log riwayat sensor terpaginasi.
- `GET /api/telemetry/analytics?device_id=device0`: Mendapatkan ringkasan statistik harian berdasarkan `device_id`.
- `GET /api/telemetry/download?device_id=device0`: Mengunduh data riwayat log sensor lengkap dalam format CSV.
- `GET /api/telemetry/nodes`: Mendapatkan seluruh daftar `device_id` unik yang terdaftar.
- `GET /api/telemetry/device-logs`: Mendapatkan riwayat log konektivitas online/offline ESP32.

### Control, Settings & OTA

- `POST /api/control`: Mengirim perintah manual (ON/OFF/AUTO) ke relay ESP32 berdasarkan `device_id`.
- `GET /api/settings?device_id=device0` & `POST /api/settings`: Mengatur ambang batas sensor berdasarkan `device_id`.
- `POST /api/ota/upload`: Mengunggah file `.bin` untuk update firmware jarak jauh berdasarkan `device_id`.
- `GET /api/ota/firmware.bin`: Endpoint publik untuk mengunduh firmware terunggah.

---

## 📟 MQTT Broker & Topics Reference

Sistem menggunakan MQTT broker (misal: HiveMQ) untuk komunikasi dua arah yang responsif dengan perangkat ESP32.

### Topics

#### 1. `smartfarm/telemetry`
- **Arah**: ESP32 $\rightarrow$ Backend (Publish)
- **Kegunaan**: Mengirimkan data sensor real-time, status relay, mode/state relay, serta pembaruan status instalasi OTA.
- **Format Payload**:
  - *Data Telemetri*:
    ```json
    {
      "id": "device0",     // ID Perangkat
      "t": 28.5,           // Suhu Udara (°C)
      "h": 65.2,           // Kelembapan Udara (%)
      "s": 42.0,           // Kelembapan Tanah (%)
      "l": 80.5,           // Intensitas Cahaya (%)
      "sk": true,          // Status aktif relay Kipas (true = ON, false = OFF)
      "ek": "IDLE",        // State relay Kipas ("MANUAL", "IDLE", "TRIGGERED", "ON", "COOLDOWN", "UNKNOWN")
      "sp": false,         // Status aktif relay Pompa
      "ep": "AUTO",        // State relay Pompa
      "sl": true,          // Status aktif relay Lampu
      "el": "MANUAL"       // State relay Lampu
    }
    ```
  - *Status FOTA*:
    ```json
    {
      "id": "device0",
      "state_ota": "MENUNGGU" // Nilai: "MENUNGGU", "MENDOWNLOAD", "MENGINSTALL", "GAGAL", "TIDAK_ADA_UPDATE", "BERHASIL"
    }
    ```

#### 2. `smartfarm/control`
- **Arah**: Backend $\rightarrow$ ESP32 (Publish)
- **Kegunaan**: Mengirim perintah override manual/auto untuk relay kipas, pompa, atau lampu.
- **Format Payload**:
  ```json
  {
    "id": "device0",
    "kipas": 0       // Nilai override: 0 (AUTO / Resume), 1 (MANUAL ON), 2 (MANUAL OFF)
  }
  ```

#### 3. `smartfarm/settings`
- **Arah**: Backend $\rightarrow$ ESP32 (Publish)
- **Kegunaan**: Mengirimkan pengaturan ambang batas dinamis baru untuk sensor otomatisasi.
- **Format Payload**:
  ```json
  {
    "id": "device0",
    "temp": 32.5,    // Ambang batas suhu (°C)
    "hum": 70.0,     // Ambang batas kelembapan (%)
    "light": 50.0    // Ambang batas cahaya (%)
  }
  ```

#### 4. `smartfarm/ota`
- **Arah**: Backend $\rightarrow$ ESP32 (Publish)
- **Kegunaan**: Memicu pembaharuan firmware OTA (FOTA) pada perangkat.
- **Format Payload**:
  ```json
  {
    "id": "device0",
    "url": "http://<ip-address>:<port>/api/ota/firmware.bin"
  }
  ```

---

## ☁️ External API Integrations (Frontend)

Aplikasi Frontend mengonsumsi API pihak ketiga secara langsung untuk menampilkan prakiraan cuaca di dashboard:

### Open-Meteo Weather Forecast API

Digunakan untuk mendapatkan data ramalan cuaca 7 hari secara per-jam/harian berdasarkan koordinat lokasi rumah kaca.

- **Endpoint**: `GET https://api.open-meteo.com/v1/forecast`
- **Parameter Query**:
  - `latitude`: Koordinat lintang lokasi perangkat.
  - `longitude`: Koordinat bujur lokasi perangkat.
  - `hourly`: Kumpulan variabel sensor cuaca per-jam (`temperature_2m`, `relative_humidity_2m`, `apparent_temperature`, `wind_speed_10m`, `surface_pressure`, `precipitation`, `weather_code`, `soil_moisture_0_to_1cm`).
  - `timezone`: Zona waktu lokasi (`auto`).
  - `forecast_days`: Jumlah hari prakiraan cuaca (`7`).
