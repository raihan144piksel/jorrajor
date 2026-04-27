import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

// Otomatis sisipkan token di setiap request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("app_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
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

export const getTelemetry = async (filter = "20") => {
  const response = await apiClient.get("/telemetry", { params: { filter } });
  return response.data;
};

export const getAnalytics = async () => {
  const response = await apiClient.get("/analytics");
  return response.data;
};

export const sendControl = async (device, status) => {
  const response = await apiClient.post("/control", { device, status });
  return response.data;
};

export const login = async (username, password) => {
  const response = await apiClient.post("/login", { username, password });
  return response.data;
};

export const getDownloadUrl = async () => {
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
