import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { getTelemetry, getAnalytics, sendControl, getSettings, getLoginLogs, getDeviceLogs, getNodes, backendUrl, ChatMessage } from "../services/api";
import { TelemetryData, AnalyticsData, ThresholdSettings as ThresholdSettingsType, LoginLogData, DeviceLogData } from "../types";
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
import AiPanel from "../components/AiPanel";
import toast from "react-hot-toast";
import { Shield, User, Globe, RefreshCw, Download, ShieldCheck, ShieldAlert, Wifi, Cpu } from "lucide-react";

/**
 * Komponen Dashboard merender halaman dashboard utama ZENITH Smart Farm.
 * Mengintegrasikan navigasi sidebar, visualisasi data real-time, grafik tren analitis, kontrol manual aktuator,
 * pengaturan threshold otomatisasi, panel asisten AI Gemini, dan log riwayat login/perangkat.
 */
const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [loginLogs, setLoginLogs] = useState<LoginLogData[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [deviceLogs, setDeviceLogs] = useState<DeviceLogData[]>([]);
  const [isLoadingDeviceLogs, setIsLoadingDeviceLogs] = useState(false);
  const [subLogTab, setSubLogTab] = useState<"login" | "device">("login");
  const [nodes, setNodes] = useState<string[]>(["device0"]);
  const [selectedNode, setSelectedNode] = useState<string>("device0");
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
  const [espStatuses, setEspStatuses] = useState<Record<string, boolean>>({});
  const isEspOnline = espStatuses[selectedNode] || false;
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdSettingsType | null>(null);
  const [otaStatus, setOtaStatus] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      text: "Halo! Saya adalah ZENITH AI Greenhouse Assistant. Saya memantau kondisi greenhouse Anda secara real-time. Ada yang bisa saya bantu hari ini?",
    },
  ]);

  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);
  const selectedNodeRef = useRef(selectedNode);

  useEffect(() => {
    selectedNodeRef.current = selectedNode;
  }, [selectedNode]);

  /**
   * Menghapus token dari localStorage, memutus koneksi websocket, dan mengarahkan kembali ke halaman login.
   */
  const handleLogout = () => {
    localStorage.removeItem("app_token");
    socketRef.current?.disconnect();
    toast.success("Berhasil logout");
    navigate("/login");
  };

  /**
   * Mengambil ulang data statistik analitik terbaru dan memperbarui daftar node aktif dari API.
   */
  const refreshStats = () => {
    getAnalytics(selectedNode)
      .then((res) => setAnalytics(res))
      .catch((err) => console.error("Stats Error:", err));
    getNodes()
      .then((res) => {
        if (res && res.length > 0) setNodes(res);
      })
      .catch((err) => console.error("Gagal refresh list node:", err));
  };

  // Load unique nodes on mount
  useEffect(() => {
    getNodes()
      .then((res) => {
        if (res && res.length > 0) {
          setNodes(res);
          if (!res.includes(selectedNode)) {
            setSelectedNode(res[0]);
          }
        }
      })
      .catch((err) => console.error("Gagal memuat list node:", err));
  }, []);

  // 1. Load for Live History, Stats, and Thresholds based on selectedNode
  useEffect(() => {
    getTelemetry("30m", "none", selectedNode).then(res => {
      setLiveHistory(res || []);
      if (res && res.length > 0) {
        const latestTime = new Date(res[res.length - 1].timestamp).getTime();
        // If the latest data is older than 24 hours, change default analytics range to 30d
        if (latestTime < Date.now() - 24 * 60 * 60 * 1000) {
          setAnalyticsRange("30d");
        }
      }
    });
    refreshStats();
    getSettings(selectedNode).then(res => setThresholds(res)).catch(err => console.error("Stats Error:", err));
  }, [selectedNode]);

  // 1.5. Threshold Alert Toasts
  useEffect(() => {
    if (liveHistory.length < 2 || !thresholds) return;
    
    const latest = liveHistory[liveHistory.length - 1];
    const prev = liveHistory[liveHistory.length - 2];

    if (latest.suhu > thresholds.temp_threshold && prev.suhu <= thresholds.temp_threshold) {
        toast("Suhu Terlalu Panas! Kipas otomatis menyala.", { icon: "🔥", style: { background: '#7f1d1d', color: '#fff' }, duration: 4000 });
    }
    if (latest.tanah < thresholds.hum_threshold && prev.tanah >= thresholds.hum_threshold) {
        toast("Tanah Kering! Pompa otomatis menyala.", { icon: "💧", style: { background: '#1e3a8a', color: '#fff' }, duration: 4000 });
    }
  }, [liveHistory, thresholds]);

  // 2. Load Analytics Data when tab, range, or selectedNode changes
  useEffect(() => {
    if (activeTab === "analytics") {
      let bin = "5m";
      if (analyticsRange === "30d") bin = "1d";
      else if (analyticsRange === "7d") bin = "1h";
      else if (analyticsRange === "1h") bin = "1m";
      
      getTelemetry(analyticsRange, bin, selectedNode).then(res => setAnalyticsHistory(res || []));
    }
  }, [activeTab, analyticsRange, selectedNode]);

  // Fetch Login Logs on tab change
  /**
   * Mengambil data log percobaan masuk (login logs) dari server backend.
   */
  const fetchLogs = () => {
    setIsLoadingLogs(true);
    getLoginLogs()
      .then((res) => {
        setLoginLogs(res || []);
      })
      .catch((err) => {
        console.error("Gagal mengambil log login:", err);
        toast.error("Gagal mengambil log login");
      })
      .finally(() => {
        setIsLoadingLogs(false);
      });
  };

  /**
   * Mengambil data log koneksi online/offline ESP32 dari server backend.
   */
  const fetchDeviceLogs = () => {
    setIsLoadingDeviceLogs(true);
    getDeviceLogs()
      .then((res) => {
        setDeviceLogs(res || []);
      })
      .catch((err) => {
        console.error("Gagal mengambil log koneksi:", err);
        toast.error("Gagal mengambil log koneksi");
      })
      .finally(() => {
        setIsLoadingDeviceLogs(false);
      });
  };

  /**
   * Mengekspor log aktivitas login pengguna saat ini ke file CSV dan mengunduhnya di browser.
   */
  const exportLoginLogs = () => {
    if (loginLogs.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const headers = ["Waktu", "Username", "IP Address", "Status"];
    const csvRows = [headers.join(",")];
    for (const log of loginLogs) {
      const row = [
        new Date(log.timestamp).toISOString(),
        log.username,
        log.ip_address,
        log.status
      ];
      const escaped = row.map(val => {
        const s = String(val);
        if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      });
      csvRows.push(escaped.join(","));
    }
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `log_login_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Berhasil mengekspor log login");
  };

  /**
   * Mengekspor log status koneksi ESP32 saat ini ke file CSV dan mengunduhnya di browser.
   */
  const exportDeviceLogs = () => {
    if (deviceLogs.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }
    const headers = ["Waktu", "Device ID", "Event"];
    const csvRows = [headers.join(",")];
    for (const log of deviceLogs) {
      const row = [
        new Date(log.timestamp).toISOString(),
        log.device_id,
        log.event
      ];
      const escaped = row.map(val => {
        const s = String(val);
        if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      });
      csvRows.push(escaped.join(","));
    }
    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `log_device_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Berhasil mengekspor log koneksi");
  };

  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
      fetchDeviceLogs();
    }
  }, [activeTab]);



  // ============================================================
  // PEMANTAUAN WEBSOCKET (SOCKET.IO): Koneksi & Event Listeners
  // ============================================================
  // Hook useEffect ini menginisialisasi koneksi WebSocket client secara real-time ke backend.
  // Dilengkapi dengan token JWT untuk autentikasi dan mekanisme auto-reconnect jika koneksi terputus.
  useEffect(() => {
    const token = localStorage.getItem("app_token");
    
    // Inisialisasi koneksi Socket.io dengan opsi konfigurasi
    const socket = io(backendUrl, {
      auth: { token },                      // Menyertakan token JWT untuk melewati middleware otentikasi backend
      transports: ["polling", "websocket"], // Mendukung polling HTTP dan Websocket murni (untuk fleksibilitas firewall)
      reconnection: true,                   // Mengaktifkan fitur koneksi ulang otomatis
      reconnectionDelay: 1000,              // Delay jeda 1 detik sebelum mencoba koneksi ulang pertama
      reconnectionAttempts: 10,             // Batas percobaan koneksi ulang maksimal 10 kali
    });

    socketRef.current = socket;

    // --- EVENT: Terhubung / Terputus ke Server Backend ---
    socket.on("connect", () => setIsOnline(true));
    socket.on("disconnect", () => setIsOnline(false));

    // --- EVENT: Menerima Daftar Status Online Semua Node ESP32 ---
    socket.on("esp_statuses", (statuses: Record<string, boolean>) => {
      setEspStatuses(statuses);
    });

    // --- EVENT: Update Status Online Satu Node ESP32 (Online/Offline) ---
    socket.on("esp_status", (payload: { device_id: string; online: boolean }) => {
      setEspStatuses((prev) => ({ ...prev, [payload.device_id]: payload.online }));
    });

    // --- EVENT: Update Progress Status FOTA (Update Firmware) ---
    socket.on("ota_status", (status: string) => {
      setOtaStatus(status);
    });

    // --- EVENT: Menerima Telemetri Sensor Real-Time (Live Stream) ---
    socket.on("telemetry_live", (payload: TelemetryData & { device_id?: string }) => {
      // Abaikan data jika data berasal dari node lain yang tidak sedang dipilih di UI dropdown
      if (payload.device_id && payload.device_id !== selectedNodeRef.current) return;

      const dataWithTime = {
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString(),
      };

      // Perbarui state data sensor utama untuk memperbarui widget card sensor
      setData(dataWithTime);
      
      // Masukkan data baru ke dalam array riwayat live history untuk memperbarui grafik real-time
      setLiveHistory((prev) => {
        // Mencegah duplikasi data berdasarkan timestamp yang sama
        if (prev.some((d) => d.timestamp === dataWithTime.timestamp)) return prev;
        
        // Simpan maksimal 100 data sensor terakhir untuk menjaga performa rendering grafik browser
        return [...prev, dataWithTime]
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
          .slice(-100);
      });
    });

    // Clean-up function: Memutus koneksi WebSocket saat komponen di-unmount (misal saat berpindah halaman/logout)
    return () => {
      socket.disconnect();
    };
  }, []);

  /**
   * Mengirimkan perintah kontrol aktuator (kipas, pompa, lampu) ke backend.
   * 
   * @param device - Jenis aktuator yang ingin dikontrol
   * @param mode - Mode kontrol (0 = Auto, 1 = Manual ON, 2 = Manual OFF)
   */
  const handleControl = async (device: string, mode: number) => {
    try {
      await sendControl(device, mode, selectedNode);
    } catch (err) {
      console.error(`[Override] Gagal mengontrol ${device}:`, err);
    }
  };

  /**
   * Merender konten dinamis dashboard berdasarkan tab menu navigasi samping yang sedang aktif.
   */
  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <SensorGrid data={data} />
            <ActuatorGrid data={data} thresholds={thresholds} onControl={handleControl} />
            
            <div className="bg-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl border border-slate-700/50">
              <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6">Grafik Real-time</h2>
              <HistoryChart data={liveHistory} />
            </div>
          </div>
        );
      case "analytics":
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            <AnalyticsGrid analytics={analytics} />
            
            <div className="bg-slate-800 p-4 sm:p-6 rounded-3xl shadow-xl border border-slate-700/50">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Tren Strategis ({analyticsRange})</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Data Agregat Aktif</span>
                  </div>
                </div>
                
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                  {["1j", "6j", "24j", "7h", "30h"].map((range) => (
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

            <TelemetryTable selectedNode={selectedNode} thresholds={thresholds} />
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
            <ThresholdSettings 
              selectedNode={selectedNode} 
              thresholds={thresholds} 
              onThresholdsChange={setThresholds} 
            />
            <FotaPanel otaStatus={otaStatus} selectedNode={selectedNode} />
          </div>
        );
      case "ai":
        return (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <AiPanel 
              selectedNode={selectedNode} 
              messages={aiMessages}
              setMessages={setAiMessages}
              onThresholdsChange={setThresholds}
            />
          </div>
        );
      case "logs": {
        const successCount = loginLogs.filter(l => l.status === "SUCCESS").length;
        const failedCount = loginLogs.filter(l => l.status === "FAILED").length;
        const latestLogin = loginLogs.find(l => l.status === "SUCCESS");
        const latestIp = latestLogin ? latestLogin.ip_address : "-";
        const disconnectCount = deviceLogs.filter(d => d.event === "OFFLINE").length;

        const activeLogsCount = subLogTab === "login" ? loginLogs.length : deviceLogs.length;
        const isCurrentlyLoading = subLogTab === "login" ? isLoadingLogs : isLoadingDeviceLogs;

        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* STATS CARDS SECTION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Card 1: Sukses Login */}
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 flex items-center gap-4 shadow-lg hover:border-slate-600 transition-all duration-300">
                <div className="bg-emerald-500/10 p-3 rounded-xl text-emerald-400">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Akses Berhasil</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{successCount}</h3>
                </div>
              </div>

              {/* Card 2: Percobaan Gagal */}
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 flex items-center gap-4 shadow-lg hover:border-slate-600 transition-all duration-300">
                <div className="bg-rose-500/10 p-3 rounded-xl text-rose-400">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Percobaan Gagal</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{failedCount}</h3>
                </div>
              </div>

              {/* Card 3: Diskoneksi IoT */}
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 flex items-center gap-4 shadow-lg hover:border-slate-600 transition-all duration-300">
                <div className="bg-amber-500/10 p-3 rounded-xl text-amber-400">
                  <Wifi size={24} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Koneksi Putus IoT</p>
                  <h3 className="text-2xl font-bold text-white mt-1">{disconnectCount} Kali</h3>
                </div>
              </div>

              {/* Card 4: IP Terakhir */}
              <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50 flex items-center gap-4 shadow-lg hover:border-slate-600 transition-all duration-300">
                <div className="bg-blue-500/10 p-3 rounded-xl text-blue-400">
                  <Globe size={24} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">IP Akses Sukses</p>
                  <h3 className="text-base font-bold text-white mt-1 font-mono truncate max-w-[150px]">{latestIp}</h3>
                </div>
              </div>
            </div>

            {/* TAB SELECTORS */}
            <div className="flex bg-slate-900/60 p-1.5 rounded-2xl border border-slate-800/80 max-w-xs shadow-inner">
              <button
                onClick={() => setSubLogTab("login")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                  subLogTab === "login"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <User size={14} />
                <span>Akses Akun</span>
              </button>
              <button
                onClick={() => setSubLogTab("device")}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl transition-all duration-200 ${
                  subLogTab === "device"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Cpu size={14} />
                <span>Koneksi ESP32</span>
              </button>
            </div>

            {/* CENTRAL LOGS CONTAINER */}
            <div className="bg-slate-800 rounded-3xl shadow-xl overflow-hidden border border-slate-700/50">
              <div className="p-6 border-b border-slate-700/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                    {subLogTab === "login" ? (
                      <>
                        <Shield className="text-blue-400" size={24} />
                        Log Percobaan Masuk (Login)
                      </>
                    ) : (
                      <>
                        <Cpu className="text-blue-400" size={24} />
                        Log Koneksi & Status ESP32
                      </>
                    )}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {subLogTab === "login"
                      ? "Memantau riwayat akses akun dan IP address percobaan login ke sistem."
                      : "Memantau aktivitas status online/offline modul sensor ESP32."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    onClick={subLogTab === "login" ? exportLoginLogs : exportDeviceLogs}
                    disabled={isCurrentlyLoading || activeLogsCount === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm shadow-lg shadow-emerald-600/15 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Ekspor CSV</span>
                  </button>
                  <button
                    onClick={subLogTab === "login" ? fetchLogs : fetchDeviceLogs}
                    disabled={isCurrentlyLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-colors disabled:opacity-50 text-sm cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCurrentlyLoading ? 'animate-spin' : ''}`} />
                    <span>Segarkan</span>
                  </button>
                  <span className="text-sm text-slate-400 bg-slate-900 px-3 py-2 rounded-xl border border-slate-700 font-mono">
                    Total: {activeLogsCount} Entri
                  </span>
                </div>
              </div>

              {/* DYNAMIC LOG TABLES */}
              {subLogTab === "login" ? (
                <div className="overflow-x-auto max-h-125 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-medium">Pengguna</th>
                        <th className="px-6 py-4 font-medium">Alamat IP</th>
                        <th className="px-6 py-4 font-medium text-center">Status</th>
                        <th className="px-6 py-4 font-medium">Waktu Percobaan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {loginLogs.map((log) => (
                        <tr 
                          key={log._id} 
                          className="hover:bg-slate-700/30 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="bg-slate-700/50 p-1.5 rounded-lg text-slate-400 group-hover:text-blue-400 transition-colors">
                                <User size={14} />
                              </div>
                              <span className="text-sm font-semibold text-slate-200">
                                {log.username}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="bg-slate-700/50 p-1.5 rounded-lg text-slate-400 group-hover:text-blue-400 transition-colors">
                                <Globe size={14} />
                              </div>
                              <span className="text-sm font-mono text-slate-300">
                                {log.ip_address}
                              </span>
                              {log.ip_address === "127.0.0.1" || log.ip_address === "::1" || log.ip_address === "::ffff:127.0.0.1" ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 font-medium">
                                  Lokal
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                              log.status === "SUCCESS" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                log.status === "SUCCESS" ? "bg-emerald-400" : "bg-rose-400"
                              }`} />
                              {log.status === "SUCCESS" ? "BERHASIL" : "GAGAL"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-300 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                              {new Date(log.timestamp).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric"
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-125 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="px-6 py-4 font-medium">Perangkat ID</th>
                        <th className="px-6 py-4 font-medium text-center">Status Event</th>
                        <th className="px-6 py-4 font-medium">Waktu Kejadian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {deviceLogs.map((log) => (
                        <tr 
                          key={log._id} 
                          className="hover:bg-slate-700/30 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="bg-slate-700/50 p-1.5 rounded-lg text-slate-400 group-hover:text-blue-400 transition-colors">
                                <Cpu size={14} />
                              </div>
                              <span className="text-sm font-semibold text-slate-200 font-mono">
                                {log.device_id}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                              log.event === "ONLINE" 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                log.event === "ONLINE" ? "bg-emerald-400" : "bg-rose-400"
                              }`} />
                              {log.event === "ONLINE" ? "TERHUBUNG" : "TERPUTUS"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-slate-300 font-mono">
                              {new Date(log.timestamp).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit"
                              })}
                            </div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                              {new Date(log.timestamp).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric"
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* EMPTY LOGS STATE */}
              {activeLogsCount === 0 && !isCurrentlyLoading && (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2 animate-in fade-in duration-300">
                  <Shield size={36} className="text-slate-600 mb-2" />
                  <p className="font-semibold text-slate-400">
                    {subLogTab === "login" ? "Belum ada riwayat masuk" : "Belum ada riwayat konektivitas perangkat"}
                  </p>
                  <p className="text-xs text-slate-600">
                    {subLogTab === "login" 
                      ? "Semua aktivitas login akan terekam dan ditampilkan di sini." 
                      : "Semua aktivitas status online/offline modul sensor ESP32 akan terekam di sini."}
                  </p>
                </div>
              )}

              {/* LOADING STATE */}
              {isCurrentlyLoading && activeLogsCount === 0 && (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2 animate-in fade-in duration-300">
                  <RefreshCw className="animate-spin text-blue-500 mb-2" size={32} />
                  <p className="font-semibold text-slate-400">Sedang memuat data log...</p>
                </div>
              )}
              
              <div className="p-4 bg-slate-900/30 text-center border-t border-slate-700/50">
                <p className="text-[11px] text-slate-500 italic">
                  {subLogTab === "login"
                    ? "* Menampilkan hingga 50 aktivitas login terakhir demi keamanan dan performa optimal."
                    : "* Menampilkan hingga 50 aktivitas status koneksi ESP32 terakhir demi performa optimal."}
                </p>
              </div>
            </div>
          </div>
        );
      }
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

      <main className="flex-1 p-4 lg:p-10 pb-24 lg:pb-10 overflow-y-auto overflow-x-hidden">
        <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
          <DashboardHeader
            isOnline={isOnline}
            isEspOnline={isEspOnline}
            onLogout={handleLogout}
            nodes={nodes}
            selectedNode={selectedNode}
            setSelectedNode={setSelectedNode}
          />
          
          {renderContent()}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
