import express, { type Request, type Response } from "express";
import { Parser } from "json2csv";
import Telemetry from "../models/Telemetry.js";
import { authenticateToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { filter } = req.query;
      let result;

      if (filter === "hourly_5m") {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        result = await Telemetry.aggregate([
          { $match: { timestamp: { $gte: last24h } } },
          {
            $group: {
              _id: {
                $dateTrunc: {
                  date: "$timestamp",
                  unit: "minute",
                  binSize: 5,
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

        if (result.length === 0) {
          const fallbackData = await Telemetry.find()
            .sort({ timestamp: -1 })
            .limit(20);
          result = fallbackData.reverse();
        }
      } else if (filter === "realtime_30m") {
        const m30 = new Date(Date.now() - 30 * 60 * 1000);
        result = await Telemetry.find({ timestamp: { $gte: m30 } }).sort({
          timestamp: 1,
        });

        if (result.length === 0) {
          const fallbackData = await Telemetry.find()
            .sort({ timestamp: -1 })
            .limit(20);
          result = fallbackData.reverse();
        }
      } else {
        // Fallback
        const data = await Telemetry.find().sort({ timestamp: -1 }).limit(20);
        result = data.reverse();
      }

      res.json(result);
    } catch (err: any) {
      console.error("Error telemetry API:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

router.get(
  "/download",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const docs = await Telemetry.find().sort({ timestamp: -1 }).limit(500);

      if (docs.length === 0) {
        res.status(404).send("Data masih kosong, belum bisa download.");
        return;
      }

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

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(docs);

      const fileName = `log_smartfarm_${new Date().toISOString().split("T")[0]}.csv`;

      res.header("Content-Type", "text/csv");
      res.attachment(fileName);
      res.send(csv);
    } catch (err) {
      console.error("Gagal download CSV:", err);
      res.status(500).send("Internal Server Error");
    }
  },
);

router.get(
  "/analytics",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const satuHariLalu = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const countCheck = await Telemetry.countDocuments({
        timestamp: { $gte: satuHariLalu },
      });

      let filter: any = { timestamp: { $gte: satuHariLalu } };
      if (countCheck === 0) {
        filter = {};
        console.log("⚠️ Data 24j kosong, menggunakan mode Global Scan");
      }

      const [statsResult, docTerendah] = await Promise.all([
        Telemetry.aggregate([
          { $match: filter },
          {
            $group: {
              _id: null,
              rataSuhu: { $avg: "$suhu" },
              maxSuhu: { $max: "$suhu" },
              minSuhu: { $min: "$suhu" },
              totalData: { $sum: 1 },
            },
          },
        ]),
        Telemetry.findOne(filter).sort({
          tanah: 1,
        }),
      ]);

      const stats = statsResult[0];

      if (!stats) {
        res.json({
          rataSuhu: "--",
          maxSuhu: "--",
          minSuhu: "--",
          totalMenit: 0,
          jamTanahKering: "--",
          nilaiTanahKering: "--",
        });
        return;
      }

      res.json({
        rataSuhu: stats.rataSuhu ? stats.rataSuhu.toFixed(1) : "--",
        maxSuhu: stats.maxSuhu ? stats.maxSuhu.toFixed(1) : "--",
        minSuhu: stats.minSuhu ? stats.minSuhu.toFixed(1) : "--",
        totalMenit: stats.totalData || 0,
        jamTanahKering: docTerendah
          ? new Date(docTerendah.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--",
        nilaiTanahKering: docTerendah ? docTerendah.tanah : "--",
      });
    } catch (err) {
      console.error("Analytics Error:", err);
      res.status(500).json({ error: "Gagal mengambil data analitik" });
    }
  },
);

export default router;
