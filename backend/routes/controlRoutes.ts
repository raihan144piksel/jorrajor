import express, { type Request, type Response } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getMqttClient } from "../services/mqttService.js";

const router = express.Router();

// ============================================================
// Endpoint: POST /api/control
// Deskripsi: Mengirimkan perintah kendali manual (override) ke relay ESP32.
//            Mengambil nama perangkat (kipas/pompa/lampu), status (0/1/2), dan target device_id,
//            kemudian mempublikasikannya melalui MQTT Broker ke topik control.
//            Endpoint ini dilindungi oleh middleware authenticateToken.
// ============================================================
router.post("/", authenticateToken, (req: Request, res: Response) => {
  const { device, status, device_id = "device0" } = req.body;
  
  // 1. Mengambil instance klien MQTT yang aktif
  const mqttClient = getMqttClient();
  if (mqttClient) {
    // 2. Publikasikan pesan JSON control ke topik 'smartfarm/control'
    //    Format payload: { "id": "device0", "kipas": 1 }
    mqttClient.publish(
      "smartfarm/control",
      JSON.stringify({ id: device_id, [device]: status }),
    );
  }
  
  res.json({ message: `Perintah ${device} set ke ${status} telah dikirim ke perangkat ${device_id}.` });
});

export default router;
