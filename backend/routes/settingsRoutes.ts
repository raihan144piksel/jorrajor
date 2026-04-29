import express, { type Request, type Response } from "express";
import Settings from "../models/Settings.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getMqttClient } from "../services/mqttService.js";

const router = express.Router();

router
  .route("/")
  .get(authenticateToken, async (req: Request, res: Response) => {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json(settings);
  })
  .post(authenticateToken, async (req: Request, res: Response) => {
    const { temp_threshold, hum_threshold, light_threshold } = req.body;

    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();

    settings.temp_threshold = temp_threshold;
    settings.hum_threshold = hum_threshold;
    settings.light_threshold = light_threshold;
    settings.updated_at = new Date();
    await settings.save();

    const mqttClient = getMqttClient();
    if (mqttClient) {
      mqttClient.publish(
        "smartfarm/settings",
        JSON.stringify({
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
