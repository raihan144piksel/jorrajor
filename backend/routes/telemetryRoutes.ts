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
      const rangeStr = (req.query.range as string) || "30m";
      const binStr = (req.query.bin as string) || "none";

      let msRange = 30 * 60 * 1000;
      if (rangeStr.endsWith("m")) msRange = parseInt(rangeStr) * 60 * 1000;
      else if (rangeStr.endsWith("h")) msRange = parseInt(rangeStr) * 60 * 60 * 1000;
      else if (rangeStr.endsWith("d")) msRange = parseInt(rangeStr) * 24 * 60 * 60 * 1000;

      const startTime = new Date(Date.now() - msRange);
      let result;

      if (binStr === "none") {
        result = await Telemetry.find({ timestamp: { $gte: startTime } }).sort({ timestamp: 1 });
      } else {
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

        result = await Telemetry.aggregate([
          { $match: { timestamp: { $gte: startTime } } },
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

      if (result.length === 0) {
        const fallbackData = await Telemetry.find().sort({ timestamp: -1 }).limit(20);
        result = fallbackData.reverse();
      }

      res.json(result);
    } catch (err: unknown) {
      console.error("Error telemetry API:", err);
      res.status(500).json({ error: (err as Error).message });
    }
  },
);

router.get(
  "/table",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      const [docs, total] = await Promise.all([
        Telemetry.find().sort({ timestamp: -1 }).skip(skip).limit(limit),
        Telemetry.countDocuments()
      ]);

      res.json({ docs, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err: unknown) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
);

router.get(
  "/download",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const rangeStr = (req.query.range as string) || "24h";

      let msRange = 24 * 60 * 60 * 1000;
      if (rangeStr.endsWith("m")) msRange = parseInt(rangeStr) * 60 * 1000;
      else if (rangeStr.endsWith("h")) msRange = parseInt(rangeStr) * 60 * 60 * 1000;
      else if (rangeStr.endsWith("d")) msRange = parseInt(rangeStr) * 24 * 60 * 60 * 1000;

      const startTime = new Date(Date.now() - msRange);
      
      // Export mentah (tanpa binning) agar data excel lengkap dan akurat
      const docs = await Telemetry.find({ timestamp: { $gte: startTime } }).sort({ timestamp: 1 });

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

      let filter: Record<string, unknown> = { timestamp: { $gte: satuHariLalu } };
      if (countCheck === 0) {
        filter = {};
        console.log("⚠️ Data 24j kosong, menggunakan mode Global Scan");
      }

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
          tanah: 1,
        }),
        Telemetry.countDocuments({}), // Total data seluruh waktu
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

export default router;
