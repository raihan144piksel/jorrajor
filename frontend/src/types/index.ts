export interface TelemetryData {
  suhu: number;
  kelembapan_udara: number;
  tanah: number;
  cahaya: number;
  status_kipas: boolean;
  status_pompa: boolean;
  status_lampu: boolean;
  state_kipas: string;
  state_pompa: string;
  state_lampu: string;
  timestamp: string;
}

export interface AnalyticsData {
  rataSuhu: string | number;
  maxSuhu: string | number;
  minSuhu: string | number;
  totalMenit: number;
  jamTanahKering: string;
  nilaiTanahKering: string | number;
}

export interface ThresholdSettings {
  temp_threshold: number;
  hum_threshold: number;
  light_threshold: number;
  retention_days: number;
}

export interface ControlPayload {
  device: "kipas" | "pompa" | "lampu";
  status: boolean;
}
