import axios from "axios";

const API_URL = import.meta.env.VITE_API_BASE_URL;

const getAuthHeader = () => {
  const token = localStorage.getItem("smartfarm_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getTelemetry = async (filter = "20") => {
  try {
    const response = await axios.get(`${API_URL}/telemetry`, {
      params: { filter },
      headers: getAuthHeader()
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching telemetry:", error);
    return [];
  }
};
export const getAnalytics = async () => {
  try {
    const response = await axios.get(`${API_URL}/analytics`, {
      headers: getAuthHeader(),
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return null;
  }
};
export const sendControl = async (device, status) => {
  const response = await axios.post(
    `${API_URL}/control`,
    { device, status },
    { headers: getAuthHeader() },
  );
  return response.data;
};
export const getDownloadUrl = () => `${API_URL}/telemetry/download`;