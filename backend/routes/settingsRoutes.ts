import express, { type Request, type Response } from "express";
import Settings from "../models/Settings.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getMqttClient } from "../services/mqttService.js";

const router = express.Router();

// ============================================================
// Route: /api/settings
// Deskripsi: Mengambil (GET) atau memperbarui (POST) nilai batas ambang (threshold) sensor 
//            dan durasi retensi penyimpanan data untuk perangkat tertentu.
//            Semua route dilindungi oleh middleware authenticateToken.
// ============================================================
router
  .route("/")
  // --- 1. GET /api/settings ---
  // Mengambil konfigurasi threshold saat ini dari database untuk device_id tertentu.
  .get(authenticateToken, async (req: Request, res: Response) => {
    const device_id = (req.query.device_id as string) || "device0";
    let settings = await Settings.findOne({ device_id });
    // Jika konfigurasi belum ada di database, buat konfigurasi default untuk device_id tersebut
    if (!settings) settings = await Settings.create({ device_id });
    res.json(settings);
  })
  // --- 2. POST /api/settings ---
  // Memperbarui threshold sensor di DB dan mempublikasikan data perubahan tersebut
  // ke ESP32 via broker MQTT agar threshold di firmware ter-update secara real-time.
  .post(authenticateToken, async (req: Request, res: Response) => {
    const { device_id = "device0", temp_threshold, hum_threshold, light_threshold, retention_days } = req.body;

    let settings = await Settings.findOne({ device_id });
    if (!settings) {
      settings = new Settings({ device_id });
    }

    // Mengubah nilai threshold baru
    settings.temp_threshold = temp_threshold;
    settings.hum_threshold = hum_threshold;
    settings.light_threshold = light_threshold;
    if (retention_days !== undefined) {
      settings.retention_days = retention_days;
    }
    settings.updated_at = new Date();
    await settings.save(); // Simpan perubahan ke database MongoDB

    // Publikasikan perubahan threshold ke topik MQTT 'smartfarm/settings'
    const mqttClient = getMqttClient();
    if (mqttClient) {
      mqttClient.publish(
        "smartfarm/settings",
        JSON.stringify({
          id: device_id,
          temp: temp_threshold,
          hum: hum_threshold,
          light: light_threshold,
        }),
      );
    }

    res.json({
      message: "Pengaturan berhasil diperbarui dan dikirim ke alat.",
    });
  });

export default router;
