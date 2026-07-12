import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getMqttClient } from "../services/mqttService.js";
import { ENV } from "../config/env.js";

const router = express.Router();

// ============================================================
// Fungsi: getLocalIp()
// Deskripsi: Mendeteksi alamat IP lokal (LAN) server backend secara otomatis.
//            Digunakan agar ESP32 dapat mengunduh biner firmware dalam jaringan lokal.
// ============================================================
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

// Inisialisasi folder penyimpanan file biner firmware yang diunggah
const uploadDir = path.join(process.cwd(), "uploads", "firmware");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Konfigurasi Multer untuk menangani penyimpanan file biner
const storage = multer.diskStorage({
  // ============================================================
  // Fungsi: destination()
  // Deskripsi: Menentukan direktori penyimpanan biner firmware.
  // ============================================================
  destination: (req, file, cb) => cb(null, uploadDir),
  // ============================================================
  // Fungsi: filename()
  // Deskripsi: Menentukan nama file biner firmware yang disimpan (selalu 'firmware.bin').
  // ============================================================
  filename: (req, file, cb) => cb(null, "firmware.bin"), // Nama file dikunci 'firmware.bin'
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // Membatasi ukuran file biner maksimal 2MB
});

// ============================================================
// Endpoint: POST /api/ota/upload
// Deskripsi: Mengunggah file biner firmware baru.
//            Setelah file tersimpan, endpoint memancarkan tautan download biner
//            melalui broker MQTT agar perangkat target (device_id) segera memulai proses FOTA.
//            Dilindungi oleh middleware authenticateToken.
// ============================================================
router.post("/upload", authenticateToken, upload.single("firmware"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "File firmware tidak ditemukan." });
    return;
  }

  const { serverUrl, device_id = "device0" } = req.body;
  let baseUrl = serverUrl || `http://localhost:${ENV.PORT}`;
  
  // Jika server berjalan di localhost, ubah menjadi alamat IP lokal LAN agar dapat diakses oleh ESP32
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
     baseUrl = `http://${getLocalIp()}:${ENV.PORT}`;
  }

  const firmwareUrl = `${baseUrl}/api/ota/firmware.bin`;

  // Kirim perintah FOTA ke ESP32 via topik MQTT 'smartfarm/ota'
  const mqttClient = getMqttClient();
  if (mqttClient) {
    mqttClient.publish("smartfarm/ota", JSON.stringify({ id: device_id, url: firmwareUrl }));
  }

  res.json({ message: `Firmware berhasil diunggah. Perangkat ${device_id} sedang melakukan update.`, url: firmwareUrl });
});

// ============================================================
// Endpoint: GET /api/ota/firmware.bin
// Deskripsi: Endpoint publik bagi perangkat ESP32 untuk mendownload file biner 
//            firmware.bin secara langsung saat proses FOTA.
// ============================================================
router.get("/firmware.bin", (req, res) => {
  const file = path.join(uploadDir, "firmware.bin");
  if (fs.existsSync(file)) {
    res.sendFile(file); // Kirim file biner jika ada
  } else {
    res.status(404).send("Firmware tidak ditemukan.");
  }
});

export default router;
