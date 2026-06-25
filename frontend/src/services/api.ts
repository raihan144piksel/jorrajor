import axios, { InternalAxiosRequestConfig } from "axios";
import { TelemetryData, AnalyticsData, ThresholdSettings, LoginLogData, DeviceLogData } from "../types";

const rawBackendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
export const backendUrl = rawBackendUrl.endsWith("/") ? rawBackendUrl.slice(0, -1) : rawBackendUrl;

const rawApiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
export const apiUrl = rawApiUrl.endsWith("/") ? rawApiUrl.slice(0, -1) : rawApiUrl;

const apiClient = axios.create({
  baseURL: apiUrl,
});

// Otomatis sisipkan token di setiap request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("app_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Tangani 401 di satu tempat
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("app_token");
      window.location.href = "/login"; // hard redirect
    }
    return Promise.reject(error);
  },
);

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

export const getAnalytics = async (device_id = "device0"): Promise<AnalyticsData> => {
  const response = await apiClient.get<AnalyticsData>("/telemetry/analytics", {
    params: { device_id },
  });
  return response.data;
};

export const sendControl = async (
  device: string,
  status: boolean | number,
  device_id = "device0",
): Promise<{ message: string }> => {
  const response = await apiClient.post("/control", { device, status, device_id });
  return response.data;
};

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

export const getDownloadUrl = async (device_id = "device0"): Promise<void> => {
  const response = await apiClient.get("/telemetry/download", {
    params: { device_id },
    responseType: "blob", // penting untuk file
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

export const getSettings = async (device_id = "device0"): Promise<ThresholdSettings> => {
  const response = await apiClient.get<ThresholdSettings>("/settings", {
    params: { device_id },
  });
  return response.data;
};

export const updateSettings = async (
  settings: Partial<ThresholdSettings> & { device_id?: string },
): Promise<{ message: string }> => {
  const response = await apiClient.post<{ message: string }>(
    "/settings",
    settings,
  );
  return response.data;
};

export const getLoginLogs = async (): Promise<LoginLogData[]> => {
  const response = await apiClient.get<LoginLogData[]>("/login-logs");
  return response.data;
};

export const getDeviceLogs = async (): Promise<DeviceLogData[]> => {
  const response = await apiClient.get<DeviceLogData[]>("/telemetry/device-logs");
  return response.data;
};

export const getNodes = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>("/telemetry/nodes");
  return response.data;
};

