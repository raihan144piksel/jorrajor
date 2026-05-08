import React from "react";
import { TelemetryData } from "../types";
import { 
  Thermometer, 
  Droplets, 
  Sprout, 
  Sun, 
  Clock,
  Wind,
  Zap,
  Lightbulb
} from "lucide-react";

interface TelemetryTableProps {
  data: TelemetryData[];
}

const TelemetryTable: React.FC<TelemetryTableProps> = ({ data }) => {
  // Ambil 30 data terbaru saja untuk menjaga performa & tampilan
  const sortedData = [...data]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 30);

  return (
    <div className="bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700">
      <div className="p-6 border-b border-slate-700 flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="text-blue-400" size={24} />
          Log Riwayat Sensor
        </h2>
        <span className="text-sm text-slate-400 bg-slate-900 px-3 py-1 rounded-full">
          {sortedData.length} Data Terkini
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
            {sortedData.map((row, idx) => (
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
                  <span className="text-sm font-semibold text-orange-400">
                    {row.suhu.toFixed(1)}°C
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-emerald-400">
                    {row.kelembapan_udara.toFixed(0)}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-blue-400">
                    {row.tanah.toFixed(0)}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-semibold text-yellow-400">
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
                    />
                    <StatusIcon 
                      icon={<Zap size={14} />} 
                      active={row.status_pompa} 
                      color="bg-blue-500" 
                      label="Pompa"
                    />
                    <StatusIcon 
                      icon={<Lightbulb size={14} />} 
                      active={row.status_lampu} 
                      color="bg-yellow-500" 
                      label="Lampu"
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.length === 0 && (
        <div className="p-12 text-center text-slate-500">
          Belum ada data tersedia
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

const StatusIcon = ({ 
  icon, 
  active, 
  color,
  label 
}: { 
  icon: React.ReactNode, 
  active: boolean, 
  color: string,
  label: string
}) => (
  <div className="group/icon relative">
    <div className={`p-1.5 rounded-lg transition-all ${
      active 
        ? `${color} text-white shadow-lg` 
        : "bg-slate-700 text-slate-500 opacity-40"
    }`}>
      {icon}
    </div>
    <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/icon:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-slate-700">
      {label}: {active ? "ON" : "OFF"}
    </span>
  </div>
);

export default TelemetryTable;
