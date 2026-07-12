import mqtt, { MqttClient } from "mqtt";
import axios from "axios";
import { Server } from "socket.io";
import Telemetry from "../models/Telemetry.js";
import { ENV } from "../config/env.js";
import DeviceLog from "../models/DeviceLog.js";

let mqttClient: MqttClient | undefined;
const onlineDevices = new Map<string, boolean>();
const deviceTimeouts = new Map<string, NodeJS.Timeout>();
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

// ============================================================
// Fungsi: getNotificationMessage()
// Deskripsi: Membandingkan status aktuator lama dan baru untuk mendeteksi 
//            adanya transisi menyala (false -> true) atau mati (true -> false).
//            Mengembalikan template pesan notifikasi yang sesuai, atau null jika tidak ada perubahan.
// ============================================================
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
  // ==========================================
  // TRANSMISI MQTT & WEBSOCKET: Setup Koneksi MQTT Broker (HiveMQ)
  // ==========================================
  mqttClient = mqtt.connect(ENV.MQTT_URL, {
    username: ENV.MQTT_USER,
    password: ENV.MQTT_PASS,
  });

  // ============================================================
  // Event Callback: mqttClient.on("error")
  // Deskripsi: Menangani error koneksi ke MQTT broker dan mencetaknya ke konsol.
  // ============================================================
  mqttClient.on("error", (err) => {
    console.error("❌ MQTT Connection Error:", err.message);
  });

  // ============================================================
  // Event Callback: mqttClient.on("connect")
  // Deskripsi: Callback saat berhasil terhubung ke MQTT broker.
  //            Melakukan subscribe ke topik telemetri ESP32.
  // ============================================================
  mqttClient.on("connect", () => {
    console.log("✅ Connected to HiveMQ");
    // Berlangganan (subscribe) ke topik telemetri ESP32
    mqttClient?.subscribe("smartfarm/telemetry");
  });

  // ============================================================
  // Event Callback: mqttClient.on("message")
  // Deskripsi: Event handler utama ketika menerima pesan publikasi MQTT.
  //            Memproses data sensor, menyimpannya ke database dengan deadband filter,
  //            mengirimkan update live via Socket.io, melacak status heartbeat perangkat,
  //            dan mengirimkan notifikasi Telegram bila ada transisi status aktuator.
  // ============================================================
  mqttClient.on("message", async (topic, message) => {
    if (topic === "smartfarm/telemetry") {
      try {
        const raw = JSON.parse(message.toString());
        const deviceId = raw.id || "device0";

        // Jika ini adalah pesan status FOTA, distribusikan statusnya ke frontend via WebSocket
        if (raw.state_ota) {
          io.emit("ota_status", raw.state_ota);
          return;
        }

        // Simpan status online perangkat dan kirim notifikasi ke frontend
        if (!onlineDevices.get(deviceId)) {
          onlineDevices.set(deviceId, true);
          io.emit("esp_status", { device_id: deviceId, online: true });
          DeviceLog.create({ device_id: deviceId, event: "ONLINE" }).catch((err) =>
            console.error("Gagal menyimpan log koneksi:", err)
          );
        }

        // Mengubah payload ringkas (short-keys) dari hardware ke format schema database penuh
        const data = {
          device_id: deviceId,
          suhu: raw.t,
          kelembapan_udara: raw.h,
          tanah: raw.s,
          cahaya: raw.l,
          status_kipas: raw.sk,
          state_kipas: raw.ek,
          status_pompa: raw.sp,
          state_pompa: raw.ep,
          status_lampu: raw.sl,
          state_lampu: raw.el,
          timestamp: new Date().toISOString(),
        };
        
        // ==========================================
        // TRANSMISI MQTT & WEBSOCKET: Kirim data live ke frontend via Socket.io
        // ==========================================
        io.emit("telemetry_live", data);

        // Heartbeat Logic untuk melacak apakah ESP32 tiba-tiba offline
        const oldTimeout = deviceTimeouts.get(deviceId);
        if (oldTimeout) clearTimeout(oldTimeout);

        const newTimeout = setTimeout(() => {
          onlineDevices.set(deviceId, false);
          io.emit("esp_status", { device_id: deviceId, online: false });
          console.log(`⚠️ ESP32 Offline: ${deviceId} (Timeout)`);
          DeviceLog.create({ device_id: deviceId, event: "OFFLINE" }).catch((err) =>
            console.error("Gagal menyimpan log diskoneksi:", err)
          );
        }, 30000);

        deviceTimeouts.set(deviceId, newTimeout);

        // 1. Parsing & Destructuring data sensor
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

        // ==========================================
        // ALGORITMA DEADBAND FILTER (Report by Exception)
        // ==========================================
        // Data sensor hanya dianggap berubah signifikan jika selisihnya melebihi ambang batas deadband:
        // - Suhu berubah >= 0.5°C
        // - Kelembapan Udara berubah >= 2.0%
        // - Kelembapan Tanah berubah >= 2.0%
        // - Intensitas Cahaya berubah >= 2.0%
        // - ATAU jika terjadi transisi status perangkat aktuator (Kipas, Pompa, Lampu)
        const isSignificantChange =
          Math.abs(pSuhu - lastSavedData.suhu) >= 0.5 ||
          Math.abs(pKelembapan - lastSavedData.kelembapan_udara) >= 2.0 ||
          Math.abs(pTanah - lastSavedData.tanah) >= 2.0 ||
          Math.abs(pCahaya - lastSavedData.cahaya) >= 2.0 ||
          status_kipas !== lastSavedData.status_kipas ||
          status_pompa !== lastSavedData.status_pompa ||
          status_lampu !== lastSavedData.status_lampu;

        // Force Save / Heartbeat Save: Paksa simpan data ke DB setiap 5 menit jika tidak ada perubahan signifikan
        const isTimeForced = now - lastSaveTime >= FORCE_SAVE_INTERVAL;

        // 2. Simpan ke Database MongoDB hanya jika lolos seleksi Deadband Filter / Force Save
        if (isSignificantChange || isTimeForced) {
          // Segera update variabel tracking untuk mencegah proses async ganda
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

          await Telemetry.create({
            device_id: device_id || "device0",
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
            timestamp: data.timestamp,
          });
          
          console.log(`💾 Saved to DB (Trigger: ${isSignificantChange ? 'Data Changed (Deadband Passed)' : 'Time Forced (Heartbeat)'})`);
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

          const pesanFinal = `📢 *LAPORAN SISTEM ZENITH*\n\n${pesanNotif.join("\n\n")}`;

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

// ============================================================
// Fungsi: getMqttClient()
// Deskripsi: Mengembalikan instance objek klien MQTT agar dapat digunakan di modul routing backend.
// ============================================================
export const getMqttClient = (): MqttClient | undefined => mqttClient;

// ============================================================
// Fungsi: getOnlineDevices()
// Deskripsi: Mengonversi struktur Map onlineDevices menjadi object key-value standar
//            untuk mempermudah pengiriman status koneksi perangkat ke frontend.
// ============================================================
export const getOnlineDevices = (): Record<string, boolean> => {
  const obj: Record<string, boolean> = {};
  onlineDevices.forEach((val, key) => {
    obj[key] = val;
  });
  return obj;
};
