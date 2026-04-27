import "dotenv/config";
import express from "express";
import cors from "cors";
import mqtt from "mqtt";
import mongoose from "mongoose";
import axios from "axios";
import { Parser } from "json2csv";
import { createServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const app = express();
const corsOrigin =
  process.env.NODE_ENV === "production" ? process.env.FRONTEND_URL : "*";

app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST"],
  }),
);
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Akses ditolak, token hilang!" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Token tidak valid!" });
    req.user = user;
    next();
  });
};

let espOnline = false;
let espTimeout;
let lastNotifTime = 0;
const NOTIF_COOLDOWN = 10 * 60 * 1000;
const JWT_SECRET = process.env.JWT_SECRET || "kode-rahasia-smartfarm";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
let lastStates = {
  kipas: false,
  pompa: false,
  lampu: false,
};

// 1. DATABASE SETUP (MongoDB)
// Simpan riwayat sensor
const telemetrySchema = new mongoose.Schema({
  suhu: Number,
  kelembapan_udara: Number,
  tanah: Number,
  cahaya: Number,
  status_kipas: Boolean,
  status_pompa: Boolean,
  status_lampu: Boolean,
  state_kipas: String,
  state_pompa: String,
  state_lampu: String,
  timestamp: { type: Date, default: Date.now },
});
const Telemetry = mongoose.model("Telemetry", telemetrySchema);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// 2. MQTT SETUP
const mqttClient = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USER,
  password: process.env.MQTT_PASS,
});

mqttClient.on("connect", () => {
  console.log("✅ Connected to HiveMQ");
  mqttClient.subscribe("smartfarm/telemetry");
});

mqttClient.on("message", async (topic, message) => {
  if (topic === "smartfarm/telemetry") {
    try {
      espOnline = true;
      const data = JSON.parse(message.toString());

      io.emit("telemetry_live", data);
      io.emit("esp_status", true);

      clearTimeout(espTimeout);
      espTimeout = setTimeout(() => {
        espOnline = false;
        io.emit("esp_status", false); // Beritahu Frontend ESP Offline
        console.log("⚠️ ESP32 Offline (Timeout)");
      }, 15000);

      // 1. Parsing & Destructuring data agar lebih rapi
      const {
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

      // 2. Simpan ke Database dengan field LENGKAP
      await Telemetry.create({
        suhu: parseFloat(suhu),
        kelembapan_udara: parseFloat(kelembapan_udara),
        tanah: parseFloat(tanah),
        cahaya: parseFloat(cahaya),
        status_kipas,
        status_pompa,
        status_lampu,
        state_kipas,
        state_pompa,
        state_lampu,
      });

      let pesanNotif = [];

      const cekStatus = (
        nama,
        statusSekarang,
        statusLama,
        pesanAktif,
        pesanMati,
      ) => {
        if (statusSekarang === true && statusLama === false) {
          pesanNotif.push(pesanAktif);
        } else if (statusSekarang === false && statusLama === true) {
          pesanNotif.push(pesanMati);
        }
      };

      // 2. Jalankan logika pengecekan
      cekStatus(
        "kipas",
        status_kipas,
        lastStates.kipas,
        `🌬️ *Kipas Menyala Otomatis*\nAlasan: Suhu mencapai ${suhu}°C (Threshold > 30°C)`,
        `✅ *Kipas Dimatikan*\nAlasan: Suhu sudah normal (${suhu}°C)`,
      );

      cekStatus(
        "pompa",
        status_pompa,
        lastStates.pompa,
        `💧 *Pompa Menyala Otomatis*\nAlasan: Tanah kering ${tanah}% (Threshold < 40%)`,
        `✅ *Penyiraman Selesai*\nAlasan: Kelembapan tanah cukup (${tanah}%)`,
      );

      cekStatus(
        "lampu",
        status_lampu,
        lastStates.lampu,
        `💡 *Lampu Menyala Otomatis*\nAlasan: Intensitas cahaya rendah ${cahaya}%`,
        `✅ *Lampu Dimatikan*\nAlasan: Cahaya sudah cukup (${cahaya}%)`,
      );

      // 3. Kirim ke Telegram jika ada pesan
      if (pesanNotif.length > 0) {
        const pesanFinal = `📢 *LAPORAN SISTEM SEMAI*\n\n${pesanNotif.join("\n\n")}`;

        axios
          .post(
            `https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`,
            {
              chat_id: process.env.TG_CHAT_ID,
              text: pesanFinal,
              parse_mode: "Markdown",
            },
          )
          .catch((err) => console.error("Telegram Error:", err.message));
      }

      // 4. Update State (lebih ringkas)
      lastStates = {
        kipas: status_kipas,
        pompa: status_pompa,
        lampu: status_lampu,
      };
    } catch (err) {
      console.error("Gagal memproses data MQTT:", err);
    }
  }
});

io.on("connection", (socket) => {
  socket.emit("esp_status", espOnline);
  // console.log("📱 New Client Connected, sending ESP status:", espOnline);
});

app.post("/api/login", async (req, res) => {
  const { password } = req.body;

    if (password === ADMIN_PASSWORD) {
    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token });
  }

  res.status(401).json({ message: "Password salah!" });
});

// 3. API ENDPOINTS (Untuk Dashboard)
// Ambil data terbaru untuk grafik
app.get("/api/telemetry", async (req, res) => {
  try {
    const { filter } = req.query;
    let result;

    if (filter === "1h") {
      const satuJamLalu = new Date(Date.now() - 60 * 60 * 1000);
      let data = await Telemetry.find({
        timestamp: { $gte: satuJamLalu },
      }).sort({ timestamp: 1 });

      // JIKA data kurang dari 2 (agar grafik tidak patah/titik tunggal)
      if (data.length < 2) {
        data = await Telemetry.find().sort({ timestamp: -1 }).limit(2);
        data.reverse();
      }
      result = data;
    } else {
      // DEFAULT: Ambil 20 data terakhir
      const data = await Telemetry.find().sort({ timestamp: -1 }).limit(20);
      result = data.reverse(); // Balik agar urutan waktu dari lama ke baru (kiri ke kanan di chart)
    }

    res.json(result);
  } catch (err) {
    console.error("Error telemetry API:", err);
    res.status(500).json({ error: err.message });
  }
});

// Kirim perintah ke ESP32 (Override)
app.post("/api/control", authenticateToken, (req, res) => {
  const { device, status } = req.body; // misal { "kipas": true }
  mqttClient.publish("smartfarm/control", JSON.stringify({ [device]: status }));
  res.json({ message: `Perintah ${device} set ke ${status} telah dikirim.` });
});

// Endpoint untuk Download CSV
app.get("/api/telemetry/download", async (req, res) => {
  try {
    // 1. Ambil semua data dari database (urutkan dari yang terbaru)
    const docs = await Telemetry.find().sort({ timestamp: -1 }).limit(500);

    if (docs.length === 0) {
      return res.status(404).send("Data masih kosong, belum bisa download.");
    }

    // 2. Tentukan kolom yang ingin dimasukkan ke CSV
    const fields = [
      { label: "Waktu", value: "timestamp" },
      { label: "Suhu (°C)", value: "suhu" },
      { label: "Kelembapan Udara (%)", value: "kelembapan_udara" },
      { label: "Kelembapan Tanah (%)", value: "tanah" },
      { label: "Intensitas Cahaya (%)", value: "cahaya" },
      { label: "Status Kipas", value: "status_kipas" },
      { label: "State Kipas", value: "state_kipas" },
      { label: "Status Pompa", value: "status_pompa" },
      { label: "State Pompa", value: "state_pompa" },
      { label: "Status Lampu", value: "status_lampu" },
      { label: "State Lampu", value: "state_lampu" },
    ];

    // 3. Konversi JSON ke CSV
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(docs);

    // 4. Set Header agar browser mengenalinya sebagai file unduhan
    const fileName = `log_smartfarm_${new Date().toISOString().split("T")[0]}.csv`;

    res.header("Content-Type", "text/csv");
    res.attachment(fileName);
    res.send(csv);
  } catch (err) {
    console.error("Gagal download CSV:", err);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/analytics", async (req, res) => {
  try {
    const satuHariLalu = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await Telemetry.aggregate([
      { $match: { timestamp: { $gte: satuHariLalu } } },
      {
        $group: {
          _id: null,
          rataSuhu: { $avg: "$suhu" },
          maxSuhu: { $max: "$suhu" },
          minSuhu: { $min: "$suhu" },
          tanahTerendah: { $min: "$tanah" },
          totalData: { $sum: 1 }, // Menghitung berapa banyak data masuk
          jamTanahKering: { $push: { waktu: "$timestamp", nilai: "$tanah" } },
        },
      },
    ]);

    if (stats.length === 0) return res.json({ message: "Data belum cukup" });

    // Mencari jam spesifik saat tanah paling kering
    const dataKering = stats[0].jamTanahKering.sort(
      (a, b) => a.nilai - b.nilai,
    )[0];

    res.json({
      rataSuhu: stats[0].rataSuhu.toFixed(1),
      maxSuhu: stats[0].maxSuhu,
      minSuhu: stats[0].minSuhu,
      totalMenit: stats[0].totalData,
      jamTanahKering: new Date(dataKering.waktu).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      nilaiTanahKering: dataKering.nilai,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () =>
  console.log(`🚀 Server + Socket.io running on port ${PORT}`),
);
