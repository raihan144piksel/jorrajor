import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL;

export const getTelemetry = () => axios.get(`${API_URL}/telemetry`);
export const sendControl = (device, status) => axios.post(`${API_URL}/control`, { device, status });
export const getDownloadUrl = () => `${API_URL}/telemetry/download`;