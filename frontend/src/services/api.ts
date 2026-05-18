import axios, { InternalAxiosRequestConfig } from "axios";
import { TelemetryData, AnalyticsData, ThresholdSettings } from "../types";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
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

export const getTelemetry = async (range = "30m", bin = "none"): Promise<TelemetryData[]> => {
    const response = await apiClient.get<TelemetryData[]>("/telemetry", { params: { range, bin } });
    return response.data;
};

export interface TableResponse {
  docs: TelemetryData[];
  total: number;
  page: number;
  totalPages: number;
}

export const getTableData = async (page = 1, limit = 50): Promise<TableResponse> => {
  const response = await apiClient.get<TableResponse>("/telemetry/table", { params: { page, limit } });
  return response.data;
};

export const getAnalytics = async (): Promise<AnalyticsData> => {
    const response = await apiClient.get<AnalyticsData>("/telemetry/analytics");
    return response.data;
};

export const sendControl = async (
    device: string,
    status: boolean | number,
): Promise<{ message: string }> => {
  const response = await apiClient.post("/control", { device, status });
  return response.data;
};

export const uploadFirmware = async (file: File): Promise<{ message: string }> => {
    const formData = new FormData();
    formData.append("firmware", file);
    
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    
    // Kirim URL Backend agar ESP32 tahu dari mana harus mendownloadnya
    formData.append("serverUrl", baseUrl);

    const token = localStorage.getItem("app_token");

    // apiClient tidak bisa dipakai langsung dengan FormData di Axios tanpa setup header khusus, 
    // jadi kita pakai fetch bawaan browser agar boundary multipart ter-generate otomatis.
    const response = await fetch(`${baseUrl}/api/ota/upload`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`
        },
        body: formData,
    });

    if (!response.ok) throw new Error("Gagal mengunggah firmware");
    return response.json();
};

export const login = async (username: string, password: string): Promise<{ token: string }> => {
    const response = await apiClient.post<{ token: string }>("/login", { username, password });
    return response.data;
};

export const getDownloadUrl = async (): Promise<void> => {
    const response = await apiClient.get("/telemetry/download", {
        responseType: "blob", // penting untuk file
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
        "download",
        `log_smartfarm_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

export const getSettings = async (): Promise<ThresholdSettings> => {
    const response = await apiClient.get<ThresholdSettings>("/settings");
    return response.data;
};

export const updateSettings = async (settings: Partial<ThresholdSettings>): Promise<{ message: string }> => {
    const response = await apiClient.post<{ message: string }>("/settings", settings);
    return response.data;
};
