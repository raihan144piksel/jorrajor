import React, { useState, useEffect } from "react";
import { TelemetryData, ThresholdSettings } from "../types";
import { 
  Thermometer, 
  Droplets, 
  Sprout, 
  Sun, 
  Clock,
  Wind,
  Lightbulb,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { getTableData } from "../services/api";

interface TelemetryTableProps {
  selectedNode: string;
  thresholds: ThresholdSettings | null;
}

/**
 * Komponen TelemetryTable menampilkan data log sensor historis dalam format tabel ter-paginasi.
 * Menandai nilai sensor yang melampaui ambang batas (threshold) dengan indikasi warna visual.
 * 
 * @param props - Properti komponen
 * @param props.selectedNode - ID node sensor yang sedang aktif saat ini
 * @param props.thresholds - Nilai ambang batas sensor untuk indikator peringatan
 */
const TelemetryTable: React.FC<TelemetryTableProps> = ({ selectedNode, thresholds }) => {
  const [currentData, setCurrentData] = useState<TelemetryData[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const rowsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedNode]);

  useEffect(() => {
    getTableData(currentPage, rowsPerPage, selectedNode).then(res => {
      setCurrentData(res.docs);
      setTotalPages(res.totalPages);
      setTotalRecords(res.total);
    }).catch(console.error);
  }, [currentPage, selectedNode]);

  return (
    <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="text-blue-400" size={24} />
          Log Riwayat Sensor
        </h2>
        <span className="text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full">
          Total {totalRecords} Log Terdeteksi
        </span>
      </div>

      <div className="overflow-x-auto max-h-125 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-medium">Waktu</th>
              <th className="px-6 py-4 font-medium">
                <div className="flex items-center gap-1">
                  <Thermometer size={14} /> Suhu
                </div>
              </th>
              <th className="px-6 py-4 font-medium">
                <div className="flex items-center gap-1">
                  <Droplets size={14} /> Udara
                </div>
              </th>
              <th className="px-6 py-4 font-medium">
                <div className="flex items-center gap-1">
                  <Sprout size={14} /> Tanah
                </div>
              </th>
              <th className="px-6 py-4 font-medium">
                <div className="flex items-center gap-1">
                  <Sun size={14} /> Cahaya
                </div>
              </th>
              <th className="px-6 py-4 font-medium text-center">Status Perangkat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {currentData.map((row, idx) => (
              <tr 
                key={idx} 
                className="hover:bg-slate-700/30 transition-colors group"
              >
                <td className="px-6 py-4">
                  <div className="text-sm text-slate-300 font-mono">
                    {new Date(row.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase">
                    {new Date(row.timestamp).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short"
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-semibold transition-colors ${
                    thresholds && row.suhu >= thresholds.temp_threshold ? "text-red-500 animate-pulse" : 
                    row.suhu < 20 ? "text-blue-300" : "text-orange-400"
                  }`}>
                    {row.suhu.toFixed(1)}°C
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-semibold transition-colors ${
                    row.kelembapan_udara < 40 ? "text-yellow-500" : "text-emerald-400"
                  }`}>
                    {row.kelembapan_udara.toFixed(0)}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-semibold transition-colors ${
                    thresholds && row.tanah <= thresholds.hum_threshold ? "text-red-400 animate-pulse" : "text-blue-400"
                  }`}>
                    {row.tanah.toFixed(0)}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-semibold transition-colors ${
                    thresholds && row.cahaya <= thresholds.light_threshold ? "text-yellow-600 animate-pulse" : "text-yellow-400"
                  }`}>
                    {row.cahaya.toFixed(0)}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-center gap-3">
                    <StatusIcon 
                      icon={<Wind size={14} />} 
                      active={row.status_kipas} 
                      color="bg-cyan-500" 
                      label="Kipas"
                      state={row.state_kipas}
                    />
                    <StatusIcon 
                      icon={<Droplets size={14} />} 
                      active={row.status_pompa} 
                      color="bg-blue-500" 
                      label="Pompa"
                      state={row.state_pompa}
                    />
                    <StatusIcon 
                      icon={<Lightbulb size={14} />} 
                      active={row.status_lampu} 
                      color="bg-yellow-500" 
                      label="Lampu"
                      state={row.state_lampu}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {currentData.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          Belum ada data tersedia
        </div>
      )}

      {totalPages > 1 && (
        <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center">
          <p className="text-xs text-slate-400">
            Halaman {currentPage} dari {totalPages}
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="p-4 bg-slate-900/30 text-center">
        <p className="text-[11px] text-slate-500 italic">
          * Data di atas disinkronkan secara real-time via MQTT & Socket.io
        </p>
      </div>
    </div>
  );
};

/**
 * Komponen pembantu StatusIcon untuk merender ikon status aktuator individu (Kipas, Pompa, Lampu)
 * beserta badge penanda mode operasi AUTO (A) atau MANUAL (M) dan tooltip.
 */
const StatusIcon = ({ 
  icon, 
  active, 
  color,
  label,
  state
}: { 
  icon: React.ReactNode, 
  active: boolean, 
  color: string,
  label: string,
  state?: string
}) => {
  // ESP32 sekarang mengirim "MANUAL" secara eksplisit saat di-override
  const isManual = state === "MANUAL";

  return (
    <div className="group/icon relative flex items-center gap-1">
      <div className={`p-1.5 rounded-lg transition-all ${
        active 
          ? `${color} text-white shadow-lg` 
          : "bg-slate-700 text-slate-500 opacity-40"
      }`}>
        {icon}
      </div>
      
      {/* Badge Auto/Manual */}
      {active && (
        <span className={`text-[9px] font-bold px-1 rounded ${isManual ? 'bg-purple-500/20 text-purple-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
          {isManual ? 'M' : 'A'}
        </span>
      )}

      <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700 z-10">
        {label}: {active ? "ON" : "OFF"} {active ? (isManual ? "(Manual)" : "(Auto)") : ""}
        <br/>
        <span className="text-[8px] text-slate-400">State: {state || "UNKNOWN"}</span>
      </span>
    </div>
  );
};

export default TelemetryTable;
