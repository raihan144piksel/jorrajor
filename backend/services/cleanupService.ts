import Telemetry from "../models/Telemetry.js";
import Settings from "../models/Settings.js";

// ============================================================
// Fungsi: startCleanupJob()
// Deskripsi: Memulai pekerjaan latar belakang (background job) untuk membersihkan data telemetri usang.
//            Menjalankan pembersihan pertama kali saat server menyala, lalu menjadwalkannya setiap 1 jam sekali.
// ============================================================
export const startCleanupJob = () => {
  // Jalankan pembersihan saat server pertama kali menyala
  runCleanup();

  // Kemudian jadwalkan secara berkala setiap 1 jam sekali (3600000 ms)
  setInterval(runCleanup, 60 * 60 * 1000);
};

// ============================================================
// Fungsi: runCleanup()
// Deskripsi: Menghapus data telemetri yang umurnya melewati batas retensi 
//            (retention_days) yang diatur oleh pengguna di dashboard (default 30 hari).
// ============================================================
const runCleanup = async () => {
  try {
    // 1. Membaca waktu batas retensi (retention_days) dari database
    const settings = await Settings.findOne();
    const retentionDays = settings?.retention_days || 30; // Default fallback 30 hari jika tidak diset

    // 2. Hitung tanggal pemotongan (cutoff date)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // 3. Hapus data telemetri yang bertanggal lebih lama dari tanggal cutoff
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
