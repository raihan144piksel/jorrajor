import Telemetry from "../models/Telemetry.js";
import Settings from "../models/Settings.js";

export const startCleanupJob = () => {
  // Jalankan pembersihan saat server pertama kali menyala
  runCleanup();

  // Kemudian jadwalkan setiap 1 jam
  setInterval(runCleanup, 60 * 60 * 1000);
};

const runCleanup = async () => {
  try {
    const settings = await Settings.findOne();
    const retentionDays = settings?.retention_days || 30; // Default 30 hari

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await Telemetry.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    if (result.deletedCount > 0) {
      console.log(
        `[Cleanup] Berhasil menghapus ${result.deletedCount} data telemetri yang lebih lama dari ${retentionDays} hari.`
      );
    }
  } catch (err) {
    console.error("[Cleanup] Gagal menjalankan pembersihan data:", err);
  }
};
