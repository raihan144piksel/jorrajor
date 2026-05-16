import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { getTelemetry, getAnalytics, sendControl } from "../services/api";
import { TelemetryData, AnalyticsData } from "../types";
import DashboardHeader from "../components/DashboardHeader";
import SensorGrid from "../components/SensorGrid";
import ActuatorGrid from "../components/ActuatorGrid";
import HistoryChart from "../components/HistoryChart";
import AnalyticsGrid from "../components/AnalyticsGrid";
import TelemetryTable from "../components/TelemetryTable";
import Sidebar from "../components/Sidebar";
import WeatherForecast from "../components/WeatherForecast";
import ThresholdSettings from "../components/ThresholdSettings";
import FotaPanel from "../components/FotaPanel";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState<TelemetryData>({
    suhu: 0,
    kelembapan_udara: 0,
    tanah: 0,
    cahaya: 0,
    status_kipas: false,
    status_pompa: false,
    status_lampu: false,
    state_kipas: "AUTO",
    state_pompa: "AUTO",
    state_lampu: "AUTO",
    timestamp: new Date().toISOString(),
  });

  // Dual-Stream History
  const [liveHistory, setLiveHistory] = useState<TelemetryData[]>([]);
  const [analyticsHistory, setAnalyticsHistory] = useState<TelemetryData[]>([]);
  const [analyticsRange, setAnalyticsRange] = useState("24h");
  
  const [isOnline, setIsOnline] = useState(false);
  const [isEspOnline, setIsEspOnline] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);

  const handleLogout = () => {
    localStorage.removeItem("app_token");
    socketRef.current?.disconnect();
    navigate("/login");
  };

  const refreshStats = () => {
    getAnalytics()
      .then((res) => setAnalytics(res))
      .catch((err) => console.error("Stats Error:", err));
  };

  // 1. Initial Load for Live History
  useEffect(() => {
    getTelemetry("30m", "none").then(res => setLiveHistory(res || []));
    refreshStats();
  }, []);

  // 2. Load Analytics Data when tab or range changes
  useEffect(() => {
    if (activeTab === "analytics") {
      let bin = "5m";
      if (analyticsRange === "30d") bin = "1d";
      else if (analyticsRange === "7d") bin = "1h";
      else if (analyticsRange === "1h") bin = "1m";
      
      getTelemetry(analyticsRange, bin).then(res => setAnalyticsHistory(res || []));
    }
  }, [activeTab, analyticsRange]);

  // 3. Socket.io Connection
  useEffect(() => {
    const token = localStorage.getItem("app_token");
    const socket = io(API_URL, {
      auth: { token },
      transports: ["polling", "websocket"], // Mulai dengan polling untuk stabilitas, lalu upgrade
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsOnline(true));
    socket.on("disconnect", () => setIsOnline(false));

    socket.on("esp_status", (online: boolean) => {
      setIsEspOnline(online);
    });

    socket.on("telemetry_live", (payload: TelemetryData) => {
      const dataWithTime = {
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      setData(dataWithTime);
      
      // Update Live History (socket raw data)
      setLiveHistory((prev) => {
        if (prev.some((d) => d.timestamp === dataWithTime.timestamp)) return prev;
        return [...prev, dataWithTime]
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(-100);
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleControl = async (device: string, mode: number) => {
    try {
      await sendControl(device, mode);
    } catch (err) {
      console.error(`[Override] Gagal mengontrol ${device}:`, err);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <SensorGrid data={data} />
            <ActuatorGrid data={data} onControl={handleControl} />
            
            <div className="bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-700/50">
              <h2 className="text-xl font-bold text-white mb-6">Grafik Real-time</h2>
              <HistoryChart data={liveHistory} />
            </div>
          </div>
        );
      case "analytics":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <AnalyticsGrid analytics={analytics} />
            
            <div className="bg-slate-800 p-6 rounded-3xl shadow-xl border border-slate-700/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-white">Tren Strategis ({analyticsRange})</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Data Agregat Aktif</span>
                  </div>
                </div>
                
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                  {["1h", "6h", "24h", "7d", "30d"].map((range) => (
                    <button
                      key={range}
                      onClick={() => setAnalyticsRange(range)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        analyticsRange === range 
                          ? "bg-blue-600 text-white shadow-md" 
                          : "text-slate-400 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <HistoryChart data={analyticsHistory} />
            </div>

            <TelemetryTable />
          </div>
        );
      case "weather":
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <WeatherForecast />
          </div>
        );
      case "settings":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <ThresholdSettings />
            <FotaPanel />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 font-sans text-slate-200">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout} 
      />

      <main className="flex-1 p-4 md:p-10 pb-24 md:pb-10 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-8">
          <DashboardHeader
            isOnline={isOnline}
            isEspOnline={isEspOnline}
            onLogout={handleLogout}
            activeRange={analyticsRange}
          />
          
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
