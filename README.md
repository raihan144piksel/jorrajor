# 🌱 Zenith Smart System — Enterprise IoT Dashboard

![Smart Farm Dashboard Mockup](preview.png)

Zenith Smart System adalah sistem monitoring dan otomatisasi rumah kaca berbasis IoT yang modern, responsif, dan _type-safe_. Proyek ini mencakup ekosistem lengkap mulai dari **Firmware (ESP32)**, **Backend (Node.js/TypeScript)**, hingga **Frontend (React/TypeScript)**.

## ✨ Fitur Utama

- **Real-time Monitoring**: Visualisasi data sensor (Suhu, Kelembapan, Tanah, Cahaya) secara instan via Socket.io.
- **Multi-Node Support**: Pemantauan dan kontrol beberapa node rumah kaca (zona/device ID) secara dinamis dari satu dashboard.
- **Dynamic Threshold**: Pengaturan ambang batas relay yang bisa diubah langsung dari dashboard tanpa _reflash_ alat.
- **Deadband Filter**: Optimasi database (Report by Exception) — data hanya disimpan jika ada perubahan signifikan, menghemat storage.
- **Non-Blocking Architecture**: Firmware ESP32 tetap menjalankan otomatisasi meskipun koneksi WiFi/MQTT terputus.
- **WiFiManager**: Konfigurasi WiFi dinamis melalui Captive Portal (tanpa _hardcoded_ SSID/Password). ESP32 akan membaca kredensial dari NVS Flash, dan jika gagal terhubung, ia akan otomatis membuat Access Point sendiri agar Anda dapat menginput SSID & Password secara nirkabel melalui browser HP/PC.
- **History Analytics**: Grafik historis dengan agregasi 5-menit (Database Level) dan sistem _caching_ di frontend.
- **Resilient History Fallback**: Sistem cerdas yang mendeteksi status offline perangkat dan menyesuaikan rentang waktu grafik serta unduhan agar selalu menampilkan rentang waktu aktif terakhir (bukan grafik kosong).
- **FOTA Update Feedback**: Monitoring status instalasi firmware ESP32 jarak jauh (OTA) secara real-time langsung dari dashboard (Downloading, Installing, Success, Failed).
- **Telegram Alerts**: Notifikasi otomatis ke Telegram saat pompa/kipas/lampu berubah status.
- **Activity & Connection Logs**: Log riwayat percobaan masuk pengguna (disertai IP Address) dan status konektivitas (online/offline) perangkat ESP32.

---

## 🏗️ Struktur Proyek

- `/frontend`: Aplikasi React + Vite + Tailwind + TypeScript.
- `/backend`: Server Node.js + Express + MongoDB + Socket.io + TypeScript.
- `/firmware`: Firmware ESP32 (C++ / PlatformIO).

---

## 🚀 Persiapan & Instalasi

### 1. Backend Setup

Masuk ke folder `backend`, lalu install dependensi:

```bash
cd backend
npm install
```

Salin file `.env.example` menjadi `.env` di folder `backend/` lalu sesuaikan nilainya:

```bash
cp .env.example .env
```

> [!IMPORTANT]
> Backend menggunakan pola **Fail-Fast**. Jika ada variabel lingkungan di dalam `.env` yang tidak diisi atau tidak valid, server tidak akan berjalan.

> [!NOTE]
> **Admin Account Seeding**: Saat backend pertama kali dijalankan, sistem akan secara otomatis membuat (seeding) satu akun administrator default ke dalam database MongoDB menggunakan kredensial dari `ADMIN_USERNAME` dan `ADMIN_PASSWORD` yang Anda definisikan di file `.env`. Gunakan kredensial ini untuk masuk ke dashboard pertama kali.

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

Salin file `.env.example` menjadi `.env` di folder `frontend/` lalu sesuaikan nilainya:

```bash
cp .env.example .env
```

Jalankan dashboard:

```bash
npm run dev
```

### 3. Firmware ESP32

1. Masuk ke folder `/firmware`.
2. Salin file `src/config.h.example` menjadi `src/config.h` lalu lengkapi konfigurasi perangkat, WiFi, dan MQTT di dalamnya:

   ```bash
   cp src/config.h.example src/config.h
   ```

3. Jalankan perintah PlatformIO untuk mengompilasi, mengunggah ke ESP32, dan memantau serial port:
   - **Kompilasi / Build**:
     ```bash
     pio run
     ```
   - **Upload & Monitor**:
     ```bash
     pio run --target upload --target monitor
     ```
     atau dengan parameter singkat:
     ```bash
     pio run -t upload -t monitor
     ```

4. Setelah menyala, hubungkan HP Anda ke WiFi **"SEMAI-SmartFarm"** (Pass: `admin123`) untuk mengatur koneksi internet alat (jika WiFi default tidak terhubung).

---

## 🔌 API & MQTT Reference

Dokumentasi lengkap mengenai REST API, MQTT topics, dan integrasi API eksternal dapat dilihat di berkas [api_and_mqtt.md](api_and_mqtt.md).

---

## 🛡️ Keamanan & Autentikasi

Proyek ini menerapkan standar keamanan industri untuk melindungi data dan akses perangkat:

1.  **Argon2 Hashing**: Kata sandi pengguna tidak disimpan dalam bentuk teks biasa. Kita menggunakan algoritma `argon2` yang sangat aman untuk melakukan hash password sebelum disimpan ke database, melindunginya dari serangan _brute-force_ dan _rainbow table_.
2.  **JSON Web Token (JWT)**: Setelah login berhasil, server akan mengeluarkan token terenkripsi. Token ini digunakan oleh Frontend untuk membuktikan identitasnya pada setiap request ke API tanpa perlu mengirim ulang password.
3.  **Rate Limiting**: Endpoint login dilindungi oleh _rate limiter_ untuk mencegah serangan _brute-force_.
4.  **Protected Routes**: Middleware pada backend memastikan bahwa hanya pengguna dengan token valid yang dapat melihat data sensor atau mengontrol perangkat farm.

## ⚙️ Mekanisme Ketahanan & Optimasi

Proyek ini dirancang dengan standar industri untuk memastikan efisiensi penyimpanan data backend dan ketahanan fisik hardware relay:

### 1. Deadband Filter (Report by Exception)

Untuk menghemat ruang penyimpanan database, backend menyaring data telemetri yang dikirim oleh ESP32. Data baru hanya akan disimpan ke database MongoDB jika memenuhi salah satu kondisi berikut:

- Terjadi perubahan suhu udara $\ge 0.5^\circ\text{C}$ dibanding data tersimpan terakhir.
- Terjadi perubahan kelembapan udara $\ge 2.0\%$ dibanding data tersimpan terakhir.
- Terjadi perubahan kelembapan tanah $\ge 2.0\%$ dibanding data tersimpan terakhir.
- Terjadi perubahan intensitas cahaya $\ge 2.0\%$ dibanding data tersimpan terakhir.
- Terjadi perubahan status relay aktif (ON/OFF).
- Waktu paksa simpan (Force Save Heartbeat) tercapai, yaitu setiap 5 menit sekali.

### 2. Pembersihan Otomatis Database (Retention Policy)

Backend memiliki _cleanup background job_ yang berjalan saat server dinyalakan dan diulang setiap 1 jam. Job ini secara otomatis menghapus data telemetri historis yang lebih lama dari jumlah hari retensi yang diatur (default: 30 hari) di tabel pengaturan.

### 3. Relay State Machine (Firmware)

Guna menghindari kerusakan mekanis actuator akibat perubahan kondisi sensor yang berfluktuasi terlalu cepat (relay hammering), firmware ESP32 mengimplementasikan mesin status (_State Machine_) dengan mekanisme berikut:

- **Debounce Penyalaan (DURASI_TRIGGER: 6 detik)**: Kondisi buruk sensor harus bertahan stabil selama minimal 6 detik sebelum relay dapat diubah menjadi `ON`.
- **Durasi Aktif Minimum**: Pompa minimal menyala 2 detik, Kipas 10 detik, dan Lampu 10 detik.
- **Debounce Pemadaman**: Kondisi normal sensor harus bertahan stabil selama minimal 6 detik sebelum relay diubah kembali menjadi `OFF`.
- **Cooldown (DURASI_COOLDOWN: 10 detik)**: Setelah relay padam, ia dipaksa berada dalam status `COOLDOWN` selama 10 detik dan tidak dapat dinyalakan kembali dalam masa jeda tersebut untuk melindungi sirkuit hardware.

### 4. Konfigurasi Ambang Batas Dinamis (Dynamic Runtime Thresholds)

Ambang batas otomatisasi relay bersifat dinamis dan dapat diatur langsung melalui Web Dashboard secara runtime tanpa perlu melakukan _compile_ atau _flash_ ulang firmware ESP32. Perubahan nilai ambang batas dikirimkan melalui protokol MQTT dan langsung disimpan ke NVS Flash ESP32 agar nilai tetap bertahan meskipun perangkat mati/reboot.

Nilai ambang batas bawaan (default) sistem adalah:

- **Ambang Batas Suhu (Kipas)**: `30.0 °C` (Kipas menyala jika Suhu > Ambang Batas)
- **Ambang Batas Kelembapan Tanah (Pompa)**: `40.0 %` (Pompa menyala jika Kelembapan Tanah < Ambang Batas)
- **Ambang Batas Cahaya (Lampu)**: `50.0 %` (Lampu UV menyala jika Cahaya < Ambang Batas)

### 5. Pola Desain Perangkat Lunak Firmware (Embedded Design Patterns)
Guna menjamin keandalan pemrosesan data real-time pada microchip ESP32, firmware dirancang dengan beberapa pola berikut:
- **Cooperative Scheduler (Non-blocking)**: Penjadwalan tugas pembacaan sensor dan publikasi MQTT berjalan secara kooperatif menggunakan pengecekan waktu delta `millis()`. Hal ini menghindari penggunaan fungsi `delay()` yang memblokir instruksi, sehingga ESP32 tetap responsif memproses sinyal masuk.
- **Deferred Flash Write**: Proses penyimpanan ambang batas baru ke NVS Flash ESP32 ditunda (deferred) dan dieksekusi di akhir siklus loop utama hanya jika terjadi perubahan. Langkah ini meminimalisir wear-and-tear pada memori flash ESP32.
- **Instant Publish on Override**: Saat pengguna mengubah status relay secara manual dari dashboard, ESP32 memotong interval siklus telemetri normal (2 detik) untuk mempublikasikan status terbaru secara instan. Ini membuat tampilan antarmuka (UI) dashboard merespons dengan cepat.

---

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide Icons, Recharts, Axios.
- **Backend**: Node.js, Express, TypeScript, MongoDB (Mongoose), Socket.io, MQTT.js.
- **Firmware**: C++, PlatformIO (Arduino Framework), WiFiManager, PubSubClient.

---

## ☁️ Cara Deploy (Production)

### Backend

1. Pastikan port TCP dibuka.
2. Gunakan **PM2** dengan interpreter `tsx` agar server menyala terus-menerus:
   ```bash
   pm2 start server.ts --interpreter tsx --name zenith-backend
   ```

### Frontend

1. Build aplikasi: `npm run build`.
2. Upload folder `dist/` ke **Vercel**, **Netlify**, atau Cloud hosting.
3. Jangan lupa atur _redirect rules_ agar SPA React Router tidak mengembalikan error 404 saat halamannya di-_refresh_.

---

## 📄 Lisensi

Proyek ini bersifat open-source. Silakan modifikasi sesuai kebutuhan Anda.

**ZENITH - Solusi Modern Pertanian Indonesia**
