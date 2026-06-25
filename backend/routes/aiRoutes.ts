import express, { type Request, type Response } from "express";
import axios from "axios";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import Telemetry from "../models/Telemetry.js";
import Settings from "../models/Settings.js";
import { ENV } from "../config/env.js";
import { getMqttClient } from "../services/mqttService.js";

const router = express.Router();

router.post("/chat", authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const { message, device_id = "device0", history = [] } = req.body;

    if (!message) {
      res.status(400).json({ error: "Pesan tidak boleh kosong." });
      return;
    }

    if (!ENV.GEMINI_API_KEY) {
      res.status(503).json({
        error: "Fitur AI Asisten belum diaktifkan di server (GEMINI_API_KEY kosong).",
      });
      return;
    }

    // 1. Fetch latest telemetry and settings context for this device
    const [latestTelemetry, settings] = await Promise.all([
      Telemetry.findOne({ device_id }).sort({ timestamp: -1 }).lean(),
      Settings.findOne({ device_id }).lean(),
    ]);

    // 2. Build system instruction with real-time context
    let contextText = `Konteks Greenhouse Saat Ini (Device: ${device_id}):\n`;
    if (latestTelemetry) {
      contextText += `- Suhu: ${latestTelemetry.suhu.toFixed(1)}°C\n`;
      contextText += `- Kelembapan Udara: ${latestTelemetry.kelembapan_udara.toFixed(0)}%\n`;
      contextText += `- Kelembapan Tanah: ${latestTelemetry.tanah.toFixed(0)}%\n`;
      contextText += `- Intensitas Cahaya: ${latestTelemetry.cahaya.toFixed(0)}%\n`;
      contextText += `- Status Kipas: ${latestTelemetry.status_kipas ? "ON" : "OFF"} (Mode: ${latestTelemetry.state_kipas || "AUTO"})\n`;
      contextText += `- Status Pompa: ${latestTelemetry.status_pompa ? "ON" : "OFF"} (Mode: ${latestTelemetry.state_pompa || "AUTO"})\n`;
      contextText += `- Status Lampu: ${latestTelemetry.status_lampu ? "ON" : "OFF"} (Mode: ${latestTelemetry.state_lampu || "AUTO"})\n`;
      contextText += `- Update Terakhir: ${new Date(latestTelemetry.timestamp).toLocaleString("id-ID")}\n`;
    } else {
      contextText += `- Tidak ada data telemetry terbaru untuk device ini.\n`;
    }

    if (settings) {
      contextText += `Ambang Batas (Thresholds) Aktif:\n`;
      contextText += `- Threshold Suhu (Kipas): ${settings.temp_threshold}°C\n`;
      contextText += `- Threshold Kelembapan Tanah (Pompa): ${settings.hum_threshold}%\n`;
      contextText += `- Threshold Cahaya (Lampu): ${settings.light_threshold}%\n`;
    }

    const systemPrompt = `Anda adalah SEMAI AI Greenhouse Assistant, asisten ahli pertanian pintar (smart farming) dan otomatisasi IoT untuk sistem rumah kaca SEMAI.
Tugas Anda adalah membantu pengguna menganalisis, merawat, dan memantau kondisi rumah kaca mereka.

Berikut adalah kondisi real-time greenhouse pengguna saat ini:
${contextText}

Instruksi:
1. Jawab pertanyaan pengguna dengan ramah, informatif, dan praktis menggunakan Bahasa Indonesia yang baik dan profesional.
2. Manfaatkan data kondisi real-time di atas jika relevan dengan pertanyaan pengguna (misal jika pengguna bertanya tentang suhu atau kondisi tanaman).
3. Berikan saran logis terkait otomatisasi (kipas/pompa/lampu) atau saran agronomi (kelembapan tanah kurang, cahaya kurang, dll) berdasarkan data di atas.
4. Jawab secara ringkas, jelas, dan fokus pada solusi praktis.
5. Anda dapat mengontrol perangkat atau mengubah ambang batas otomatisasi menggunakan fungsi tool yang disediakan jika diminta oleh pengguna secara eksplisit.`;

    // 3. Format history and current message into Gemini request format
    const contents: any[] = [];

    // Add chat history
    if (Array.isArray(history)) {
      for (const item of history) {
        if (item.role && item.text) {
          contents.push({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.text }],
          });
        }
      }
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${ENV.GEMINI_API_KEY}`;

    const response = await axios.post(geminiUrl, {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      tools: [{
        functionDeclarations: [
          {
            name: "control_actuator",
            description: "Mengontrol aktuator greenhouse secara manual atau mengembalikannya ke mode otomatis (kipas, pompa, atau lampu).",
            parameters: {
              type: "OBJECT",
              properties: {
                device: {
                  type: "STRING",
                  enum: ["kipas", "pompa", "lampu"],
                  description: "Nama aktuator yang ingin dikontrol."
                },
                status: {
                  type: "NUMBER",
                  description: "Mode kontrol: 0 = AUTO (kembali ke otomatisasi), 1 = ON (menyalakan paksa secara manual), 2 = OFF (mematikan paksa secara manual)"
                }
              },
              required: ["device", "status"]
            }
          },
          {
            name: "update_thresholds",
            description: "Mengubah ambang batas (threshold) otomatisasi greenhouse (ambang batas suhu kipas, kelembapan tanah pompa, atau intensitas cahaya lampu).",
            parameters: {
              type: "OBJECT",
              properties: {
                temp_threshold: {
                  type: "NUMBER",
                  description: "Ambang batas suhu untuk menyalakan kipas pendingin (°C)"
                },
                hum_threshold: {
                  type: "NUMBER",
                  description: "Ambang batas kelembapan tanah untuk menyalakan pompa air (%)"
                },
                light_threshold: {
                  type: "NUMBER",
                  description: "Ambang batas intensitas cahaya untuk menyalakan lampu UV (%)"
                }
              }
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 800,
      },
    });

    const candidate = response.data?.candidates?.[0];
    const functionCall = candidate?.content?.parts?.[0]?.functionCall;

    // Handle Tool (Function Calling) triggers if Gemini chooses to run them
    if (functionCall) {
      const { name, args } = functionCall;

      if (name === "control_actuator") {
        const { device, status } = args as { device: string; status: number };
        const mqttClient = getMqttClient();
        if (mqttClient) {
          mqttClient.publish(
            "smartfarm/control",
            JSON.stringify({ id: device_id, [device]: status }),
          );
        }
        const modeStr = status === 0 ? "AUTO (Otomatis)" : status === 1 ? "ON (Manual)" : "OFF (Manual)";
        res.json({
          message: `Saya telah mengirimkan perintah ke perangkat *${device_id}* untuk mengatur *${device.toUpperCase()}* ke mode **${modeStr}** sesuai permintaan Anda.`,
          actionTriggered: "control"
        });
        return;
      }

      if (name === "update_thresholds") {
        const { temp_threshold, hum_threshold, light_threshold } = args as {
          temp_threshold?: number;
          hum_threshold?: number;
          light_threshold?: number;
        };

        let currentSettings = await Settings.findOne({ device_id });
        if (!currentSettings) {
          currentSettings = new Settings({ device_id });
        }

        const changes: string[] = [];
        if (temp_threshold !== undefined) {
          currentSettings.temp_threshold = temp_threshold;
          changes.push(`ambang batas suhu menjadi **${temp_threshold}°C**`);
        }
        if (hum_threshold !== undefined) {
          currentSettings.hum_threshold = hum_threshold;
          changes.push(`ambang batas kelembapan tanah menjadi **${hum_threshold}%**`);
        }
        if (light_threshold !== undefined) {
          currentSettings.light_threshold = light_threshold;
          changes.push(`ambang batas cahaya menjadi **${light_threshold}%**`);
        }

        currentSettings.updated_at = new Date();
        await currentSettings.save();

        // Broadcast updated thresholds to the device
        const mqttClient = getMqttClient();
        if (mqttClient) {
          mqttClient.publish(
            "smartfarm/settings",
            JSON.stringify({
              id: device_id,
              temp: currentSettings.temp_threshold,
              hum: currentSettings.hum_threshold,
              light: currentSettings.light_threshold,
            }),
          );
        }

        res.json({
          message: `Saya telah berhasil memperbarui pengaturan untuk *${device_id}*: ${changes.join(", ")}. Pengaturan baru telah dikirim ke perangkat.`,
          actionTriggered: "settings",
          thresholds: currentSettings
        });
        return;
      }
    }

    const aiMessage = candidate?.content?.parts?.[0]?.text || "Maaf, saya tidak dapat memproses jawaban saat ini.";
    res.json({ message: aiMessage });
  } catch (err: any) {
    console.error("Gemini AI API Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Gagal berkomunikasi dengan layanan AI." });
  }
});

export default router;
