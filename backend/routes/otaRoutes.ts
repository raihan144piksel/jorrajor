import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getMqttClient } from "../services/mqttService.js";
import { ENV } from "../config/env.js";

const router = express.Router();

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

const uploadDir = path.join(process.cwd(), "uploads", "firmware");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, "firmware.bin"),
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // limit firmware file size to 2MB max
});

router.post("/upload", authenticateToken, upload.single("firmware"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "File firmware tidak ditemukan." });
    return;
  }

  const { serverUrl, device_id = "device0" } = req.body;
  let baseUrl = serverUrl || `http://localhost:${ENV.PORT}`;
  
  if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
     baseUrl = `http://${getLocalIp()}:${ENV.PORT}`;
  }

  const firmwareUrl = `${baseUrl}/api/ota/firmware.bin`;

  const mqttClient = getMqttClient();
  if (mqttClient) {
    mqttClient.publish("smartfarm/ota", JSON.stringify({ id: device_id, url: firmwareUrl }));
  }

  res.json({ message: `Firmware berhasil diunggah. Perangkat ${device_id} sedang melakukan update.`, url: firmwareUrl });
});

router.get("/firmware.bin", (req, res) => {
  const file = path.join(uploadDir, "firmware.bin");
  if (fs.existsSync(file)) {
    res.sendFile(file);
  } else {
    res.status(404).send("Firmware tidak ditemukan.");
  }
});

export default router;
