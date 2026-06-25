import express, { type Request, type Response } from "express";
import Settings from "../models/Settings.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getMqttClient } from "../services/mqttService.js";

const router = express.Router();

router
  .route("/")
  .get(authenticateToken, async (req: Request, res: Response) => {
    const device_id = (req.query.device_id as string) || "device0";
    let settings = await Settings.findOne({ device_id });
    if (!settings) settings = await Settings.create({ device_id });
    res.json(settings);
  })
  .post(authenticateToken, async (req: Request, res: Response) => {
    const { device_id = "device0", temp_threshold, hum_threshold, light_threshold, retention_days } = req.body;

    let settings = await Settings.findOne({ device_id });
    if (!settings) {
      settings = new Settings({ device_id });
    }

    settings.temp_threshold = temp_threshold;
    settings.hum_threshold = hum_threshold;
    settings.light_threshold = light_threshold;
    if (retention_days !== undefined) {
      settings.retention_days = retention_days;
    }
    settings.updated_at = new Date();
    await settings.save();

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
