import axios, { InternalAxiosRequestConfig } from "axios";
import { TelemetryData, AnalyticsData, ThresholdSettings, LoginLogData, DeviceLogData } from "../types";

// Pembersihan URL Backend dan API agar tidak berakhiran slash "/" demi kestabilan API call
const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
export const backendUrl = rawBackendUrl.endsWith("/") ? rawBackendUrl.slice(0, -1) : rawBackendUrl;

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const apiUrl = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

// Inisialisasi HTTP Client menggunakan Axios dengan Base URL API target
const apiClient = axios.create({
  baseURL: apiUrl,
});

// ============================================================
// Interceptor: Request
// Deskripsi: Menyisipkan token autentikasi JWT secara otomatis ke header Authorization
//            pada setiap request HTTP keluar.
// ============================================================
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("app_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ============================================================
// Interceptor: Response
// Deskripsi: Menangani respon error secara terpusat. Jika mendapatkan error 401 (Unauthorized),
//            token dihapus dari storage dan pengguna dipaksa diarahkan (redirect) ke halaman login.
// ============================================================
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("app_token");
      window.location.href = "/login"; // Force redirect
    }
    return Promise.reject(error);
  },
);

// ============================================================
// Fungsi: getTelemetry(range, bin, device_id)
// Deskripsi: Mengambil data telemetri sensor (suhu, kelembapan, dll) untuk keperluan grafik.
// ============================================================
export const getTelemetry = async (
  range = "30m",
  bin = "none",
  device_id = "device0",
): Promise<TelemetryData[]> => {
  const response = await apiClient.get<TelemetryData[]>("/telemetry", {
    params: { range, bin, device_id },
  });
  return response.data;
};

export interface TableResponse {
  docs: TelemetryData[];
  total: number;
  page: number;
  totalPages: number;
}

// ============================================================
// Fungsi: getTableData(page, limit, device_id)
// Deskripsi: Mengambil data telemetri ter-paginasi (per halaman) untuk mempopulasi tabel riwayat.
// ============================================================
export const getTableData = async (
  page = 1,
  limit = 50,
  device_id = "device0",
): Promise<TableResponse> => {
  const response = await apiClient.get<TableResponse>("/telemetry/table", {
    params: { page, limit, device_id },
  });
  return response.data;
};

// ============================================================
// Fungsi: getAnalytics(device_id)
// Deskripsi: Mengambil data ringkasan analitik (suhu rata-rata, min/max, kelembapan tanah terendah).
// ============================================================
export const getAnalytics = async (device_id = "device0"): Promise<AnalyticsData> => {
  const response = await apiClient.get<AnalyticsData>("/telemetry/analytics", {
    params: { device_id },
  });
  return response.data;
};

// ============================================================
// Fungsi: sendControl(device, status, device_id)
// Deskripsi: Mengirimkan perintah override manual aktuator (kipas/pompa/lampu) ke backend.
// ============================================================
export const sendControl = async (
  device: string,
  status: boolean | number,
  device_id = "device0",
): Promise<{ message: string }> => {
  const response = await apiClient.post("/control", { device, status, device_id });
  return response.data;
};

// ============================================================
// Fungsi: uploadFirmware(file, device_id)
// Deskripsi: Mengunggah file biner firmware (.bin) baru untuk proses FOTA (nirkabel)
//            dan mengirimkan informasi target node ESP32.
// ============================================================
export const uploadFirmware = async (
  file: File,
  device_id = "device0",
): Promise<{ message: string }> => {
  const formData = new FormData();
  formData.append("firmware", file);
  formData.append("device_id", device_id);

  // Kirim URL Backend agar ESP32 tahu dari mana harus mendownloadnya
  formData.append("serverUrl", backendUrl);

  const token = localStorage.getItem("app_token");

  // apiClient tidak bisa dipakai langsung dengan FormData di Axios tanpa setup header khusus,
  // jadi kita pakai fetch bawaan browser agar boundary multipart ter-generate otomatis.
  const response = await fetch(`${backendUrl}/api/ota/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) throw new Error("Gagal mengunggah firmware");
  return response.json();
};

// ============================================================
// Fungsi: login(username, password)
// Deskripsi: Memproses permintaan autentikasi login pengguna.
// ============================================================
export const login = async (
  username: string,
  password: string,
): Promise<{ token: string }> => {
  const response = await apiClient.post<{ token: string }>("/login", {
    username,
    password,
  });
  return response.data;
};

// ============================================================
// Fungsi: getDownloadUrl(device_id)
// Deskripsi: Mengunduh data log sensor mentah ke file CSV dan men-trigger proses download di browser.
// ============================================================
export const getDownloadUrl = async (device_id = "device0"): Promise<void> => {
  const response = await apiClient.get("/telemetry/download", {
    params: { device_id },
    responseType: "blob", // Menentukan jenis respon biner (Blob)
  });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute(
    "download",
    `log_smartfarm_${device_id}_${new Date().toISOString().split("T")[0]}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// ============================================================
// Fungsi: getSettings(device_id)
// Deskripsi: Mengambil data threshold suhu, tanah, cahaya untuk suatu node ESP32.
// ============================================================
export const getSettings = async (device_id = "device0"): Promise<ThresholdSettings> => {
  const response = await apiClient.get<ThresholdSettings>("/settings", {
    params: { device_id },
  });
  return response.data;
};

// ============================================================
// Fungsi: updateSettings(settings)
// Deskripsi: Mengubah nilai threshold baru di backend untuk diperbarui ke database & alat.
// ============================================================
export const updateSettings = async (
  settings: Partial<ThresholdSettings> & { device_id?: string },
): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>(
    "/settings",
    settings,
  );
  return response.data;
};

// ============================================================
// Fungsi: getLoginLogs()
// Deskripsi: Mengambil riwayat data log login aktivitas masuk user.
// ============================================================
export const getLoginLogs = async (): Promise<LoginLogData[]> => {
  const response = await apiClient.get<LoginLogData[]>("/login-logs");
  return response.data;
};

// ============================================================
// Fungsi: getDeviceLogs()
// Deskripsi: Mengambil riwayat status koneksi online/offline perangkat keras ESP32.
// ============================================================
export const getDeviceLogs = async (): Promise<DeviceLogData[]> => {
  const response = await apiClient.get<DeviceLogData[]>("/telemetry/device-logs");
  return response.data;
};

// ============================================================
// Fungsi: getNodes()
// Deskripsi: Mengambil daftar semua nama node sensor (device_id) yang aktif terdaftar.
// ============================================================
export const getNodes = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>("/telemetry/nodes");
  return response.data;
};

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatResponse {
  message: string;
  actionTriggered?: string;
  thresholds?: any;
}

export const chatWithAI = async (
  message: string,
  device_id = "device0",
  history: ChatMessage[] = [],
): Promise<ChatResponse> => {
  const response = await apiClient.post<ChatResponse>("/ai/chat", {
    message,
    device_id,
    history,
  });
  return response.data;
};

