import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

export const getTelemetry = async (filter = "20") => {
  const response = await axios.get(`${API_URL}/telemetry`, {
    params: { filter },
  });
  return response.data;
};
export const getAnalytics = async () => {
  try {
    const response = await axios.get(`${API_URL}/analytics`);
    return response.data;
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return null;
  }
};
export const sendControl = async (device, status) => {
  const response = await axios.post(`${API_URL}/control`, { device, status });
  return response.data;
};
export const getDownloadUrl = () => `${API_URL}/telemetry/download`;