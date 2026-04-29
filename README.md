# 🌱 SEMAI Smart Farm — Enterprise IoT Dashboard

![Smart Farm Dashboard Mockup](https://gitlab.com/raihan144piksel/rumahijo/-/blob/a37dc5543d08bf0fd2e4efd4384f669991c229a6/preview.png)

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
VITE_API_URL=http://localhost:3000/
```

Jalankan dashboard:

```bash
npm run dev
```

### 3. Firmware ESP32

1. Buka file di folder `/rumahijo_arduino/rumahijo_arduino.ino` menggunakan Arduino IDE.
2. Edit file `config.h` dan lengkapi konfigurasi berikut:

   ```cpp
   #ifndef CONFIG_H
   #define CONFIG_H
   // MQTT Broker
   const char* MQTT_SERVER    = "alamat_broker_anda";
   const int   MQTT_PORT      = 8883; // Port SSL
   const char* MQTT_CLIENT_ID = "nama_bebas";
   const char* MQTT_USER      = "user_mqtt";
   const char* MQTT_PASSWORD  = "pass_mqtt";

   // MQTT Topics
   const char* TOPIC_TELEMETRY = "smartfarm/telemetry";  // publish data sensor
   const char* TOPIC_CONTROL   = "smartfarm/control";    // subscribe perintah dashboard
   const char* TOPIC_SETTINGS  = "smartfarm/settings";   // subscribe pengaturan threshold

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

Semua endpoint kecuali login dilindungi oleh middleware autentikasi. Anda harus menyertakan token dalam header: `Authorization: Bearer <your_token>`.

### Auth
- `POST /api/auth/login`: Autentikasi user dan mendapatkan JWT.

### Telemetry
- `GET /api/telemetry?filter=realtime_30m`: Mendapatkan data sensor dalam rentang 30 menit terakhir.
- `GET /api/telemetry?filter=hourly_5m`: Mendapatkan data agregasi per 5 menit untuk rentang 24 jam.
- `GET /api/telemetry/analytics`: Mendapatkan ringkasan statistik (rata-rata, max, min suhu).
- `GET /api/telemetry/download`: Mengunduh log sensor dalam format CSV.

### Control & Settings
- `POST /api/control`: Mengirim perintah manual ke ESP32 (on/off relay).
- `GET /api/settings`: Mengambil konfigurasi ambang batas (threshold) saat ini.
- `POST /api/settings`: Memperbarui threshold dan mengirimkan sinyal pembaruan ke ESP32 via MQTT.

---

## 🛡️ Keamanan & Autentikasi

Proyek ini menerapkan standar keamanan industri untuk melindungi data dan akses perangkat:

1.  **Bcrypt Hashing**: Kata sandi pengguna tidak disimpan dalam bentuk teks biasa. Kita menggunakan algoritma `bcrypt` dengan *salt* untuk mengenkripsi password sebelum disimpan ke database, melindunginya dari serangan *rainbow table*.
2.  **JSON Web Token (JWT)**: Setelah login berhasil, server akan mengeluarkan token terenkripsi. Token ini digunakan oleh Frontend untuk membuktikan identitasnya pada setiap request ke API tanpa perlu mengirim ulang password.
3.  **Rate Limiting**: Endpoint login dilindungi oleh *rate limiter* untuk mencegah serangan *brute-force*.
4.  **Protected Routes**: Middleware pada backend memastikan bahwa hanya pengguna dengan token valid yang dapat melihat data sensor atau mengontrol perangkat farm.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Axios.
- **Backend**: Node.js, Express, TypeScript, MongoDB (Mongoose), Socket.io, MQTT.js.
- **Firmware**: C++, Arduino Framework, WiFiManager, PubSubClient.

---

## ☁️ Cara Deploy (Production)

### Backend

1. Build TypeScript ke JavaScript: `npm run build` (jika script tersedia) atau gunakan `tsx` untuk eksekusi langsung.
2. Gunakan **PM2** agar server tetap menyala:
   ```bash
   pm2 start server.ts --interpreter tsx
   ```

### Frontend

1. Build aplikasi: `npm run build`.
2. Upload folder `dist/` ke provider hosting statis seperti **Vercel**, **Netlify**, atau **Cloudflare Pages**.
3. Pastikan konfigurasi `rewrites` di `vercel.json` sudah aktif agar Single Page Application (SPA) berjalan lancar.

---

## 📄 Lisensi

Proyek ini bersifat open-source. Silakan modifikasi sesuai kebutuhan Anda.

**SEMAI - Solusi Modern Pertanian Indonesia**
