import mqtt, { MqttClient } from "mqtt";
import axios from "axios";
import { Server } from "socket.io";
import Telemetry from "../models/Telemetry.js";
import { ENV } from "../config/env.js";

let mqttClient: MqttClient | undefined;
let espOnline = false;
let espTimeout: NodeJS.Timeout;
let lastReportedStates = {
  kipas: false,
  pompa: false,
  lampu: false,
};

// Variables for Deadband Filter (Report by Exception)
let lastSavedData = {
  suhu: 0,
  kelembapan_udara: 0,
  tanah: 0,
  cahaya: 0,
  status_kipas: false,
  status_pompa: false,
  status_lampu: false,
};
let lastSaveTime = 0;
const FORCE_SAVE_INTERVAL = 5 * 60 * 1000; // Force save setiap 5 menit meskipun tidak ada perubahan

const getNotificationMessage = (
  statusSekarang: boolean,
  statusLama: boolean,
  pesanAktif: string,
  pesanMati: string
): string | null => {
  if (statusSekarang === true && statusLama === false) return pesanAktif;
  if (statusSekarang === false && statusLama === true) return pesanMati;
  return null;
};

export const initMqtt = (io: Server): void => {
  mqttClient = mqtt.connect(ENV.MQTT_URL, {
    username: ENV.MQTT_USER,
    password: ENV.MQTT_PASS,
  });

  mqttClient.on("error", (err) => {
    console.error("❌ MQTT Connection Error:", err.message);
  });

  mqttClient.on("connect", () => {
    console.log("✅ Connected to HiveMQ");
    mqttClient?.subscribe("smartfarm/telemetry");
  });

  mqttClient.on("message", async (topic, message) => {
    if (topic === "smartfarm/telemetry") {
      try {
        if (!espOnline) {
          espOnline = true;
          io.emit("esp_status", true);
        }
        const data = JSON.parse(message.toString());

        // INJEKSI SERVER TIME agar data selalu punya timestamp valid
        data.timestamp = new Date().toISOString();
        
        // TETAP KIRIM KE FRONTEND SECARA LIVE agar UI terasa responsif
        io.emit("telemetry_live", data);

        // Heartbeat Logic
        clearTimeout(espTimeout);
        espTimeout = setTimeout(() => {
          espOnline = false;
          io.emit("esp_status", false);
          console.log("⚠️ ESP32 Offline (Timeout)");
        }, 30000);

        // 1. Parsing & Destructuring data
        const {
          device_id,
          suhu,
          kelembapan_udara,
          tanah,
          cahaya,
          status_kipas,
          status_pompa,
          status_lampu,
          state_kipas,
          state_pompa,
          state_lampu,
        } = data;

        const pSuhu = parseFloat(suhu);
        const pKelembapan = parseFloat(kelembapan_udara);
        const pTanah = parseFloat(tanah);
        const pCahaya = parseFloat(cahaya);

        const now = Date.now();

        // DEADBAND FILTER LOGIC
        // Cek apakah ada perubahan yang "signifikan"
        const isSignificantChange =
          Math.abs(pSuhu - lastSavedData.suhu) >= 0.5 ||
          Math.abs(pKelembapan - lastSavedData.kelembapan_udara) >= 2.0 ||
          Math.abs(pTanah - lastSavedData.tanah) >= 2.0 ||
          Math.abs(pCahaya - lastSavedData.cahaya) >= 2.0 ||
          status_kipas !== lastSavedData.status_kipas ||
          status_pompa !== lastSavedData.status_pompa ||
          status_lampu !== lastSavedData.status_lampu;

        // Cek apakah sudah kelamaan tidak nyimpen data (Heartbeat Save)
        const isTimeForced = now - lastSaveTime >= FORCE_SAVE_INTERVAL;

        // 2. Simpan ke Database JIKA lolos filter
        if (isSignificantChange || isTimeForced) {
          await Telemetry.create({
            device_id: device_id || "ESP32_MAIN",
            suhu: pSuhu,
            kelembapan_udara: pKelembapan,
            tanah: pTanah,
            cahaya: pCahaya,
            status_kipas,
            status_pompa,
            status_lampu,
            state_kipas,
            state_pompa,
            state_lampu,
            timestamp: data.timestamp, // Gunakan timestamp yang sama dengan socket
          });

          // Update data terakhir yang disimpan
          lastSaveTime = now;
          lastSavedData = {
            suhu: pSuhu,
            kelembapan_udara: pKelembapan,
            tanah: pTanah,
            cahaya: pCahaya,
            status_kipas,
            status_pompa,
            status_lampu,
          };
          
          console.log(`💾 Saved to DB (Trigger: ${isSignificantChange ? 'Data Changed' : 'Time Forced'})`);
        }

        const pesanNotif: string[] = [];

        const kMsg = getNotificationMessage(
          status_kipas,
          lastReportedStates.kipas,
          `🌬️ *Kipas Menyala Otomatis*\nAlasan: Suhu mencapai ${suhu}°C`,
          `✅ *Kipas Dimatikan*\nAlasan: Suhu sudah normal (${suhu}°C)`,
        );
        if (kMsg) pesanNotif.push(kMsg);

        const pMsg = getNotificationMessage(
          status_pompa,
          lastReportedStates.pompa,
          `💧 *Pompa Menyala Otomatis*\nAlasan: Tanah kering ${tanah}%`,
          `✅ *Penyiraman Selesai*\nAlasan: Kelembapan tanah cukup (${tanah}%)`,
        );
        if (pMsg) pesanNotif.push(pMsg);

        const lMsg = getNotificationMessage(
          status_lampu,
          lastReportedStates.lampu,
          `💡 *Lampu Menyala Otomatis*\nAlasan: Intensitas cahaya rendah ${cahaya}%`,
          `✅ *Lampu Dimatikan*\nAlasan: Cahaya sudah cukup (${cahaya}%)`,
        );
        if (lMsg) pesanNotif.push(lMsg);

        // 3. Kirim ke Telegram jika ada pesan
        if (pesanNotif.length > 0) {
          // Update tracker state immediately to prevent desync
          lastReportedStates = {
            kipas: status_kipas,
            pompa: status_pompa,
            lampu: status_lampu,
          };

          const pesanFinal = `📢 *LAPORAN SISTEM SEMAI*\n\n${pesanNotif.join("\n\n")}`;

          axios
            .post(`https://api.telegram.org/bot${ENV.TG_TOKEN}/sendMessage`, {
              chat_id: ENV.TG_CHAT_ID,
              text: pesanFinal,
              parse_mode: "Markdown",
            })
            .catch((err) => console.error("Telegram Error:", err.message));
        }
      } catch (err) {
        console.error("Gagal memproses data MQTT:", err);
      }
    }
  });
};

export const getMqttClient = (): MqttClient | undefined => mqttClient;
export const isEspOnline = (): boolean => espOnline;
