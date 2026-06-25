import express, { type Request, type Response } from "express";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import { getMqttClient } from "../services/mqttService.js";

const router = express.Router();

router.post("/", authenticateToken, (req: Request, res: Response) => {
  const { device, status, device_id = "device0" } = req.body;
  
  const mqttClient = getMqttClient();
  if (mqttClient) {
    mqttClient.publish(
      "smartfarm/control",
      JSON.stringify({ id: device_id, [device]: status }),
    );
  }
  
  res.json({ message: `Perintah ${device} set ke ${status} telah dikirim ke perangkat ${device_id}.` });
});

export default router;
