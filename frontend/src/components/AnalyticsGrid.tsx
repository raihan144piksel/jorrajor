import React from "react";
import StatCard from "./StatCard";
import { AnalyticsData } from "../types";

interface AnalyticsGridProps {
  analytics: AnalyticsData | null;
}

/**
 * Komponen AnalyticsGrid menampilkan rangkuman data statistik penting (suhu rata-rata,
 * titik suhu ekstrem, tingkat kelembapan tanah paling kering, dan total data telemetry).
 * 
 * @param props - Properti komponen
 * @param props.analytics - Data analitik yang diterima dari backend
 */
const AnalyticsGrid: React.FC<AnalyticsGridProps> = ({ analytics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Kartu 1: Rata-rata Suhu */}
      <StatCard
        label="Rata-rata Suhu"
        value={`${analytics?.rataSuhu ?? "--"}°C`}
        color="border-orange-500"
      />

      {/* Kartu 2: Rentang Suhu (Ganti Estimasi Air) */}
      <StatCard
        label="Suhu Terpanas / Terdingin"
        value={`${analytics?.maxSuhu ?? "--"}° / ${analytics?.minSuhu ?? "--"}°`}
        subValue="Rekor suhu 24 jam terakhir"
        color="border-red-500"
      />

      {/* Kartu 3: Titik Terkering */}
      <StatCard
        label="Tanah Paling Kering"
        value={`${analytics?.nilaiTanahKering ?? "--"}%`}
        subValue={`Terjadi jam ${analytics?.jamTanahKering ?? "--"}`}
        color="border-emerald-500"
      />

      {/* Kartu 4: Uptime Sistem (Ganti Sistem Optimal) */}
      <StatCard
        label="Log Data (Total)"
        value={`${analytics?.totalMenit ?? "--"} Data`}
        subValue="Total data yang tersimpan"
        color="border-blue-500"
      />
    </div>
  );
};

export default AnalyticsGrid;
