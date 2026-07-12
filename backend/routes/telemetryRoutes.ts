import express, { type Request, type Response } from "express";
import Telemetry from "../models/Telemetry.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";
import DeviceLog from "../models/DeviceLog.js";

const router = express.Router();

// ============================================================
// Endpoint: GET /api/telemetry
// Deskripsi: Mengambil riwayat data telemetri sensor berdasarkan rentang waktu 
//            (30m, 24h, dll) dan melakukan agregasi data (binning/grouping) jika diminta.
//            Dilindungi oleh middleware authenticateToken.
// ============================================================
router.get(
  "/",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rangeStr = (req.query.range as string) || "30m";
      const binStr = (req.query.bin as string) || "none";
      const device_id = (req.query.device_id as string) || "device0";

      // --- 1. MENGHITUNG JARAK WAKTU QUERY ---
      let msRange = 30 * 60 * 1000; // Default 30 menit
      if (rangeStr.endsWith("m")) msRange = parseInt(rangeStr) * 60 * 1000;
      else if (rangeStr.endsWith("h")) msRange = parseInt(rangeStr) * 60 * 60 * 1000;
      else if (rangeStr.endsWith("d")) msRange = parseInt(rangeStr) * 24 * 60 * 60 * 1000;

      let endTime = new Date();
      // Mengambil timestamp data terakhir untuk menentukan batas akhir rentang pencarian data (mencegah data kosong di grafik)
      const latestDoc = await Telemetry.findOne({ device_id }).sort({ timestamp: -1 }).lean();
      if (latestDoc) {
        const latestTime = new Date(latestDoc.timestamp);
        if (latestTime.getTime() < Date.now() - 10 * 60 * 1000) {
          endTime = latestTime;
        }
      }
      const startTime = new Date(endTime.getTime() - msRange);
      if (rangeStr.endsWith("d")) {
        startTime.setHours(0, 0, 0, 0);
      }

      let result;

      // --- 2. QUERY TANPA AGREGASI (Murni) ---
      if (binStr === "none") {
        result = await Telemetry.find({ device_id, timestamp: { $gte: startTime, $lte: endTime } }).sort({ timestamp: 1 }).lean();
      } else {
        // --- 3. QUERY DENGAN AGREGASI MONGODB (Binning) ---
        let binUnit = "minute";
        let binSize = 5;
        
        if (binStr.endsWith("m")) {
          binUnit = "minute";
          binSize = parseInt(binStr);
        } else if (binStr.endsWith("h")) {
          binUnit = "hour";
          binSize = parseInt(binStr);
        } else if (binStr.endsWith("d")) {
          binUnit = "day";
          binSize = parseInt(binStr);
        }

        // Melakukan grouping rata-rata sensor berdasarkan interval waktu (binning)
        result = await Telemetry.aggregate([
          { $match: { device_id, timestamp: { $gte: startTime, $lte: endTime } } },
          {
            $group: {
              _id: {
                $dateTrunc: {
                  date: "$timestamp",
                  unit: binUnit,
                  binSize: binSize,
                },
              },
              suhu: { $avg: "$suhu" },
              kelembapan_udara: { $avg: "$kelembapan_udara" },
              tanah: { $avg: "$tanah" },
              cahaya: { $avg: "$cahaya" },
              status_kipas: { $last: "$status_kipas" },
              status_pompa: { $last: "$status_pompa" },
              status_lampu: { $last: "$status_lampu" },
              state_kipas: { $last: "$state_kipas" },
              state_pompa: { $last: "$state_pompa" },
              state_lampu: { $last: "$state_lampu" },
            },
          },
          { $sort: { _id: 1 } },
          {
            $project: {
              _id: 0,
              timestamp: "$_id",
              suhu: { $round: ["$suhu", 1] },
              kelembapan_udara: { $round: ["$kelembapan_udara", 1] },
              tanah: { $round: ["$tanah", 1] },
              cahaya: { $round: ["$cahaya", 1] },
              status_kipas: 1,
              status_pompa: 1,
              status_lampu: 1,
              state_kipas: 1,
              state_pompa: 1,
              state_lampu: 1,
            },
          },
        ]);
      }

      // Fallback jika tidak ada data dalam rentang tersebut, ambil 20 data terakhir
      if (result.length === 0) {
        const fallbackData = await Telemetry.find({ device_id }).sort({ timestamp: -1 }).limit(20).lean();
        result = fallbackData.reverse();
      }

      res.json(result);
    } catch (err: unknown) {
      console.error("Error telemetry API:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  },
);

// ============================================================
// Endpoint: GET /api/telemetry/table
// Deskripsi: Mendapatkan data telemetri dengan skema pagination (halaman)
//            untuk merender log tabel riwayat sensor di frontend.
//            Dilindungi oleh middleware authenticateToken.
// ============================================================
router.get(
  "/table",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const device_id = (req.query.device_id as string) || "device0";
      const skip = (page - 1) * limit;

      // Jalankan query pencarian dan hitung total data secara paralel
      const [docs, total] = await Promise.all([
        Telemetry.find({ device_id }).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        Telemetry.countDocuments({ device_id })
      ]);

      res.json({ docs, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ============================================================
// Endpoint: GET /api/telemetry/download
// Deskripsi: Mengekspor seluruh log data sensor ke file CSV menggunakan metode streaming
//            untuk menghemat beban memori server (heap memory).
//            Dilindungi oleh middleware authenticateToken.
// ============================================================
router.get(
  "/download",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const device_id = (req.query.device_id as string) || "device0";
      // Pastikan data tidak kosong sebelum memulai unduhan
      const hasData = await Telemetry.exists({ device_id });
      if (!hasData) {
        res.status(404).send("Data masih kosong, belum bisa download.");
        return;
      }

      const fileName = `log_smartfarm_${device_id}_${new Date().toISOString().split("T")[0]}.csv`;
      res.header("Content-Type", "text/csv");
      res.attachment(fileName);

      // Tulis baris header kolom CSV
      const headers = [
        "Waktu",
        "Suhu (°C)",
        "Kelembapan Udara (%)",
        "Kelembapan Tanah (%)",
        "Intensitas Cahaya (%)",
        "Status Kipas",
        "State Kipas",
        "Status Pompa",
        "State Pompa",
        "Status Lampu",
        "State Lampu"
      ];
      res.write(headers.join(",") + "\n");

      // Melakukan streaming data secara sekuensial dari MongoDB
      const cursor = Telemetry.find({ device_id }).sort({ timestamp: 1 }).lean().cursor();

      // Tutup kursor database jika user membatalkan unduhan (koneksi terputus)
      req.on("close", () => {
        cursor.close();
      });

      for await (const doc of cursor) {
        const row = [
          doc.timestamp ? new Date(doc.timestamp).toISOString() : "",
          doc.suhu !== undefined && doc.suhu !== null ? doc.suhu : "",
          doc.kelembapan_udara !== undefined && doc.kelembapan_udara !== null ? doc.kelembapan_udara : "",
          doc.tanah !== undefined && doc.tanah !== null ? doc.tanah : "",
          doc.cahaya !== undefined && doc.cahaya !== null ? doc.cahaya : "",
          doc.status_kipas !== undefined && doc.status_kipas !== null ? doc.status_kipas : "",
          doc.state_kipas !== undefined && doc.state_kipas !== null ? doc.state_kipas : "",
          doc.status_pompa !== undefined && doc.status_pompa !== null ? doc.status_pompa : "",
          doc.state_pompa !== undefined && doc.state_pompa !== null ? doc.state_pompa : "",
          doc.status_lampu !== undefined && doc.status_lampu !== null ? doc.status_lampu : "",
          doc.state_lampu !== undefined && doc.state_lampu !== null ? doc.state_lampu : ""
        ];

        // Format nilai string agar tidak merusak formatting CSV (escaping quotes/commas)
        const escapedRow = row.map(val => {
          const s = String(val);
          if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        });

        res.write(escapedRow.join(",") + "\n");
      }

      res.end();
    } catch (err) {
      console.error("Gagal download CSV:", err);
      if (!res.headersSent) {
        res.status(500).send("Internal Server Error");
      } else {
        res.end();
      }
    }
  },
);

// ============================================================
// Endpoint: GET /api/telemetry/analytics
// Deskripsi: Mengambil statistik agregasi harian untuk widget card analitik dashboard
//            (suhu rata-rata, suhu maks/min, kelembapan tanah terendah).
//            Dilindungi oleh middleware authenticateToken.
// ============================================================
router.get(
  "/analytics",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const device_id = (req.query.device_id as string) || "device0";
      let endTime = new Date();
      const latestDoc = await Telemetry.findOne({ device_id }).sort({ timestamp: -1 }).lean();
      if (latestDoc) {
        const latestTime = new Date(latestDoc.timestamp);
        if (latestTime.getTime() < Date.now() - 10 * 60 * 1000) {
          endTime = latestTime;
        }
      }
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000); // 24 Jam Terakhir

      const filter = { device_id, timestamp: { $gte: startTime, $lte: endTime } };

      // Menjalankan kueri agregat rata-rata/maks/min, pencarian tanah kering, dan total log secara paralel
      const [statsResult, docTerendah, totalSemua] = await Promise.all([
        Telemetry.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              rataSuhu: { $avg: "$suhu" },
              maxSuhu: { $max: "$suhu" },
              minSuhu: { $min: "$suhu" },
            },
          },
        ]),
        Telemetry.findOne(filter).sort({
          tanah: 1, // Diurutkan terkecil untuk mendeteksi tanah terkering
        }).lean(),
        Telemetry.countDocuments({ device_id }),
      ]);

      const stats = statsResult[0];

      if (!stats && totalSemua === 0) {
        res.json({
          rataSuhu: null,
          maxSuhu: null,
          minSuhu: null,
          totalMenit: 0,
          jamTanahKering: "--",
          nilaiTanahKering: null,
        });
        return;
      }

      res.json({
        rataSuhu: stats?.rataSuhu != null ? parseFloat(stats.rataSuhu.toFixed(1)) : null,
        maxSuhu: stats?.maxSuhu != null ? parseFloat(stats.maxSuhu.toFixed(1)) : null,
        minSuhu: stats?.minSuhu != null ? parseFloat(stats.minSuhu.toFixed(1)) : null,
        totalMenit: totalSemua || 0,
        jamTanahKering: docTerendah
          ? new Date(docTerendah.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--",
        nilaiTanahKering: docTerendah?.tanah != null ? parseFloat(Number(docTerendah.tanah).toFixed(1)) : null,
      });
    } catch (err) {
      console.error("Analytics Error:", err);
      res.status(500).json({ error: "Gagal mengambil data analitik" });
    }
  },
);

// ============================================================
// Endpoint: GET /api/telemetry/nodes
// Deskripsi: Mendapatkan daftar nama unik device_id (node sensor) 
//            yang pernah mengirim data ke database untuk dirender di dropdown dashboard.
//            Dilindungi oleh middleware authenticateToken.
// ============================================================
router.get(
  "/nodes",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const nodes = await Telemetry.distinct("device_id");
      const cleanNodes = nodes.filter(n => n && n !== "UNKNOWN");
      if (cleanNodes.length === 0) {
        cleanNodes.push("device0");
      }
      res.json(cleanNodes);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

// ============================================================
// Endpoint: GET /api/telemetry/device-logs
// Deskripsi: Mendapatkan 50 log terakhir mengenai status online/offline 
//            perangkat modul ESP32.
//            Dilindungi oleh middleware authenticateToken.
// ============================================================
router.get(
  "/device-logs",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const logs = await DeviceLog.find().sort({ timestamp: -1 }).limit(50).lean();
      res.json(logs);
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

export default router;
