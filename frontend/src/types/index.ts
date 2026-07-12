/**
 * Representasi data telemetri real-time dari sensor greenhouse.
 */
export interface TelemetryData {
  /** Nilai suhu udara (°C) */
  suhu: number;
  /** Persentase kelembapan udara (%) */
  kelembapan_udara: number;
  /** Persentase kelembapan tanah (%) */
  tanah: number;
  /** Persentase intensitas cahaya (%) */
  cahaya: number;
  /** Status keaktifan kipas pendingin (true = ON, false = OFF) */
  status_kipas: boolean;
  /** Status keaktifan pompa air (true = ON, false = OFF) */
  status_pompa: boolean;
  /** Status keaktifan lampu UV (true = ON, false = OFF) */
  status_lampu: boolean;
  /** Mode operasional kipas pendingin ("AUTO" atau "MANUAL") */
  state_kipas: string;
  /** Mode operasional pompa air ("AUTO" atau "MANUAL") */
  state_pompa: string;
  /** Mode operasional lampu UV ("AUTO" atau "MANUAL") */
  state_lampu: string;
  /** Timestamp waktu pengambilan data dalam format ISO string */
  timestamp: string;
}

/**
 * Data analitik ringkasan statistika telemetri sensor.
 */
export interface AnalyticsData {
  /** Rata-rata nilai suhu udara */
  rataSuhu: string | number;
  /** Nilai suhu udara tertinggi (maksimum) */
  maxSuhu: string | number;
  /** Nilai suhu udara terendah (minimum) */
  minSuhu: string | number;
  /** Total menit data terekam/aktif dalam sistem */
  totalMenit: number;
  /** Waktu kejadian saat kelembapan tanah paling kering (format string jam) */
  jamTanahKering: string;
  /** Nilai kelembapan tanah terendah (paling kering) */
  nilaiTanahKering: string | number;
}

/**
 * Pengaturan ambang batas (thresholds) otomatisasi alat dan retensi server.
 */
export interface ThresholdSettings {
  /** ID unik perangkat target (opsional) */
  device_id?: string;
  /** Batas suhu untuk memicu kipas pendingin otomatis (°C) */
  temp_threshold: number;
  /** Batas kelembapan tanah untuk memicu pompa air otomatis (%) */
  hum_threshold: number;
  /** Batas intensitas cahaya untuk memicu lampu UV otomatis (%) */
  light_threshold: number;
  /** Masa retensi log penyimpanan data telemetri di server (Hari) */
  retention_days: number;
}

/**
 * Payload data untuk mengirim perintah kontrol manual aktuator.
 */
export interface ControlPayload {
  /** Nama aktuator yang akan dikontrol */
  device: "kipas" | "pompa" | "lampu";
  /** Status target keaktifan aktuator (true = Hidup, false = Mati) */
  status: boolean;
}

/**
 * Data catatan aktivitas masuk (login logs) pengguna.
 */
export interface LoginLogData {
  /** ID unik entri log dari database */
  _id: string;
  /** Username akun yang melakukan percobaan masuk */
  username: string;
  /** Alamat IP asal koneksi login */
  ip_address: string;
  /** Status hasil login ("SUCCESS" atau "FAILED") */
  status: "SUCCESS" | "FAILED";
  /** Timestamp waktu kejadian login dalam format ISO string */
  timestamp: string;
}

/**
 * Data catatan status koneksi online/offline perangkat keras ESP32.
 */
export interface DeviceLogData {
  /** ID unik entri log dari database */
  _id: string;
  /** ID unik modul sensor/perangkat keras ESP32 */
  device_id: string;
  /** Jenis kejadian koneksi ("ONLINE" atau "OFFLINE") */
  event: "ONLINE" | "OFFLINE";
  /** Timestamp waktu kejadian dalam format ISO string */
  timestamp: string;
}
