# 🌱 SEMAI Smart Farm — Enterprise IoT Dashboard

![Smart Farm Dashboard Mockup](preview.png)

SEMAI Smart Farm adalah sistem monitoring dan otomatisasi rumah kaca berbasis IoT yang modern, responsif, dan _type-safe_. Proyek ini mencakup ekosistem lengkap mulai dari **Firmware (ESP32)**, **Backend (Node.js/TypeScript)**, hingga **Frontend (React/TypeScript)**.

## ✨ Fitur Utama

- **Real-time Monitoring**: Visualisasi data sensor (Suhu, Kelembapan, Tanah, Cahaya) secara instan via Socket.io.
- **Dynamic Threshold**: Pengaturan ambang batas relay yang bisa diubah langsung dari dashboard tanpa _reflash_ alat.
- **Deadband Filter**: Optimasi database (Report by Exception) — data hanya disimpan jika ada perubahan signifikan, menghemat storage hingga 90%.
- **Non-Blocking Architecture**: Firmware ESP32 tetap menjalankan otomatisasi meskipun koneksi WiFi/MQTT terputus.
- **WiFiManager**: Konfigurasi WiFi dinamis melalui Captive Portal (tanpa _hardcoded_ SSID/Password).
- **History Analytics**: Grafik historis dengan agregasi 5-menit (Database Level) dan sistem _caching_ di frontend.
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
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_URL=http://localhost:3000
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

Semua endpoint kecuali `/login` dilindungi oleh middleware autentikasi. Gunakan header: `Authorization: Bearer <your_token>`.

### Telemetry & Analytics
- `GET /api/telemetry?range=30m&bin=none`: Mendapatkan data sensor murni atau teragregasi.
- `GET /api/telemetry/analytics`: Mendapatkan ringkasan statistik harian (Suhu Max/Min, Jam Tanah Kering).
- `GET /api/telemetry/download`: Mengunduh log sensor mentah dalam format CSV.

### Control, Settings & OTA
- `POST /api/control`: Mengirim perintah manual (ON/OFF/AUTO) ke relay ESP32.
- `GET /api/settings` & `POST /api/settings`: Mengatur ambang batas sensor.
- `POST /api/ota/upload`: Mengunggah file `.bin` untuk update firmware jarak jauh. Mengirimkan sinyal otomatis via MQTT agar ESP32 memulai unduhan FOTA.

---

## 🛡️ Keamanan & Autentikasi

Proyek ini menerapkan standar keamanan industri untuk melindungi data dan akses perangkat:

1.  **Bcrypt Hashing**: Kata sandi pengguna tidak disimpan dalam bentuk teks biasa. Kita menggunakan algoritma `bcrypt` dengan _salt_ untuk mengenkripsi password sebelum disimpan ke database, melindunginya dari serangan _rainbow table_.
2.  **JSON Web Token (JWT)**: Setelah login berhasil, server akan mengeluarkan token terenkripsi. Token ini digunakan oleh Frontend untuk membuktikan identitasnya pada setiap request ke API tanpa perlu mengirim ulang password.
3.  **Rate Limiting**: Endpoint login dilindungi oleh _rate limiter_ untuk mencegah serangan _brute-force_.
4.  **Protected Routes**: Middleware pada backend memastikan bahwa hanya pengguna dengan token valid yang dapat melihat data sensor atau mengontrol perangkat farm.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Axios.
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
