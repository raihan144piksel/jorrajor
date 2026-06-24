import express, { type Request, type Response } from "express";
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

      let endTime = new Date();
      const latestDoc = await Telemetry.findOne().sort({ timestamp: -1 });
      if (latestDoc) {
        const latestTime = new Date(latestDoc.timestamp);
        // If the latest data is older than 10 minutes, adjust the query end time
        if (latestTime.getTime() < Date.now() - 10 * 60 * 1000) {
          endTime = latestTime;
        }
      }
      const startTime = new Date(endTime.getTime() - msRange);
      if (rangeStr.endsWith("d")) {
        startTime.setHours(0, 0, 0, 0);
      }

      let result;

      if (binStr === "none") {
        result = await Telemetry.find({ timestamp: { $gte: startTime, $lte: endTime } }).sort({ timestamp: 1 });
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
          { $match: { timestamp: { $gte: startTime, $lte: endTime } } },
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
        Telemetry.estimatedDocumentCount()
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
      // Check if any data exists at all
      const hasData = await Telemetry.exists({});
      if (!hasData) {
        res.status(404).send("Data masih kosong, belum bisa download.");
        return;
      }

      const fileName = `log_smartfarm_all_${new Date().toISOString().split("T")[0]}.csv`;
      res.header("Content-Type", "text/csv");
      res.attachment(fileName);

      // CSV headers matching the field mappings
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

      // Stream all data from MongoDB sorted by timestamp
      const cursor = Telemetry.find().sort({ timestamp: 1 }).cursor();

      // Ensure cursor is closed if the request is aborted
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

        // Format and escape CSV values to handle commas or quotes
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

router.get(
  "/analytics",
  authenticateToken,
  async (req: Request, res: Response): Promise<void> => {
    try {
      let endTime = new Date();
      const latestDoc = await Telemetry.findOne().sort({ timestamp: -1 });
      if (latestDoc) {
        const latestTime = new Date(latestDoc.timestamp);
        if (latestTime.getTime() < Date.now() - 10 * 60 * 1000) {
          endTime = latestTime;
        }
      }
      const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

      const filter = { timestamp: { $gte: startTime, $lte: endTime } };

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
        Telemetry.estimatedDocumentCount(), // Total data seluruh waktu
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
