# 🌱 SEMAI Smart Farm — Enterprise IoT Dashboard

![Smart Farm Dashboard Mockup](preview.png)

SEMAI Smart Farm adalah sistem monitoring dan otomatisasi rumah kaca berbasis IoT yang modern, responsif, dan _type-safe_. Proyek ini mencakup ekosistem lengkap mulai dari **Firmware (ESP32)**, **Backend (Node.js/TypeScript)**, hingga **Frontend (React/TypeScript)**.

## ✨ Fitur Utama

- **Real-time Monitoring**: Visualisasi data sensor (Suhu, Kelembapan, Tanah, Cahaya) secara instan via Socket.io.
- **Dynamic Threshold**: Pengaturan ambang batas relay yang bisa diubah langsung dari dashboard tanpa _reflash_ alat.
- **Deadband Filter**: Optimasi database (Report by Exception) — data hanya disimpan jika ada perubahan signifikan, menghemat storage.
- **Non-Blocking Architecture**: Firmware ESP32 tetap menjalankan otomatisasi meskipun koneksi WiFi/MQTT terputus.
- **WiFiManager**: Konfigurasi WiFi dinamis melalui Captive Portal (tanpa _hardcoded_ SSID/Password).
- **History Analytics**: Grafik historis dengan agregasi 5-menit (Database Level) dan sistem _caching_ di frontend.
- **Resilient History Fallback**: Sistem cerdas yang mendeteksi status offline perangkat dan menyesuaikan rentang waktu grafik serta unduhan agar selalu menampilkan rentang waktu aktif terakhir (bukan grafik kosong).
- **FOTA Update Feedback**: Monitoring status instalasi firmware ESP32 jarak jauh (OTA) secara real-time langsung dari dashboard (Downloading, Installing, Success, Failed).
- **Telegram Alerts**: Notifikasi otomatis ke Telegram saat pompa/kipas/lampu berubah status.

---

## 🏗️ Struktur Proyek

- `/frontend`: Aplikasi React + Vite + Tailwind + TypeScript.
- `/backend`: Server Node.js + Express + MongoDB + Socket.io + TypeScript.
- `/rumahijo_arduino`: Firmware ESP32 (C++/Arduino).

---

## 🚀 Persiapan & Instalasi

### 1. Backend Setup

Masuk ke folder `backend`, lalu install dependensi:

```bash
cd backend
npm install
```

Buat file `.env` di folder `backend/` dengan isi sebagai berikut:

```env
PORT=3000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/smartfarm
JWT_SECRET=rahasia_super_kuat_anda
FRONTEND_URL="http://localhost:5173"
NODE_ENV="production"
MQTT_URL=mqtts://broker_address:port
MQTT_USER=username_mqtt
MQTT_PASS=password_mqtt
TG_TOKEN=token_bot_telegram_anda
TG_CHAT_ID=id_chat_anda
```

> [!IMPORTANT]
> Backend menggunakan pola **Fail-Fast**. Jika ada variabel di atas yang tidak diisi, server tidak akan berjalan.

Jalankan server:

```bash
npm run dev
```

### 2. Frontend Setup

Masuk ke folder `frontend`, lalu install dependensi:

```bash
cd frontend
npm install
```

Buat file `.env` di folder `frontend/`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_BACKEND_URL=http://localhost:3000
```

Jalankan dashboard:

```bash
npm run dev
```

### 3. Firmware ESP32

1. Buka file di folder `/rumahijo_arduino/rumahijo_arduino.ino` menggunakan Arduino IDE atau Arduino CLI.
2. Edit file `config.h` dan lengkapi konfigurasi berikut:

   ```cpp
   #ifndef CONFIG_H
   #define CONFIG_H

   // DEVICE ID
   const char* DEVICE_ID      = "device0";

   // MQTT Broker
   const char* MQTT_SERVER    = "alamat_broker_anda";
   const int   MQTT_PORT      = 8883; // Port SSL/TLS
   const char* MQTT_CLIENT_ID = "semainode01";
   const char* MQTT_USER      = "user_mqtt";
   const char* MQTT_PASSWORD  = "pass_mqtt";

   // MQTT Topics
   const char* TOPIC_TELEMETRY = "smartfarm/telemetry";
   const char* TOPIC_CONTROL   = "smartfarm/control";
   const char* TOPIC_SETTINGS  = "smartfarm/settings";
   const char* TOPIC_OTA       = "smartfarm/ota";

   // Telegram (Opsional - Jika ingin notif dari alat)
   const char* TG_TOKEN       = "token_bot";
   const char* TG_CHAT_ID     = "id_chat";
   #endif
   ```

3. Install library yang dibutuhkan: `WiFiManager`, `PubSubClient`, `ArduinoJson`, `DHT sensor library`.
4. Upload ke ESP32.
5. Setelah menyala, hubungkan HP Anda ke WiFi **"SEMAI-SmartFarm"** (Pass: `admin123`) untuk mengatur koneksi internet alat.

---

## 🔌 API Reference

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

## 🛡️ Keamanan & Autentikasi

Proyek ini menerapkan standar keamanan industri untuk melindungi data dan akses perangkat:

1.  **Argon2 Hashing**: Kata sandi pengguna tidak disimpan dalam bentuk teks biasa. Kita menggunakan algoritma `argon2` yang sangat aman untuk melakukan hash password sebelum disimpan ke database, melindunginya dari serangan _brute-force_ dan _rainbow table_.
2.  **JSON Web Token (JWT)**: Setelah login berhasil, server akan mengeluarkan token terenkripsi. Token ini digunakan oleh Frontend untuk membuktikan identitasnya pada setiap request ke API tanpa perlu mengirim ulang password.
3.  **Rate Limiting**: Endpoint login dilindungi oleh _rate limiter_ untuk mencegah serangan _brute-force_.
4.  **Protected Routes**: Middleware pada backend memastikan bahwa hanya pengguna dengan token valid yang dapat melihat data sensor atau mengontrol perangkat farm.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Axios.
- **Backend**: Node.js, Express, TypeScript, MongoDB (Mongoose), Socket.io, MQTT.js.
- **Firmware**: C++, Arduino Framework, WiFiManager, PubSubClient.

---

## ☁️ Cara Deploy (Production)

### Backend

1. Pastikan port TCP dibuka.
2. Gunakan **PM2** dengan interpreter `tsx` agar server menyala terus-menerus:
   ```bash
   pm2 start server.ts --interpreter tsx --name semai-backend
   ```

### Frontend

1. Build aplikasi: `npm run build`.
2. Upload folder `dist/` ke **Vercel**, **Netlify**, atau Cloud hosting.
3. Jangan lupa atur _redirect rules_ agar SPA React Router tidak mengembalikan error 404 saat halamannya di-_refresh_.

---

## 📄 Lisensi

Proyek ini bersifat open-source. Silakan modifikasi sesuai kebutuhan Anda.

**SEMAI - Solusi Modern Pertanian Indonesia**
