import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
    getTelemetry,
    getAnalytics,
    sendControl,
} from "../services/api";
import { useNavigate } from "react-router-dom";
import { TelemetryData, AnalyticsData } from "../types";

import HistoryChart from "../components/HistoryChart";
import ControlPanel from "../components/ControlPanel";
import DashboardHeader from "../components/DashboardHeader";
import ThresholdSettings from "../components/ThresholdSettings";
import AnalyticsGrid from "../components/AnalyticsGrid";
import SensorGrid from "../components/SensorGrid";

const Dashboard: React.FC = () => {
    const [history, setHistory] = useState<TelemetryData[]>([]);
    const [isOnline, setIsOnline] = useState<boolean>(false);
    const [isEspOnline, setIsEspOnline] = useState<boolean>(false);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [chartFilter, setChartFilter] = useState<string>("realtime_30m");
    const chartCache = useRef<Record<string, TelemetryData[]>>({});

    const [data, setData] = useState<TelemetryData>({
        suhu: 0,
        kelembapan_udara: 0,
        tanah: 0,
        cahaya: 0,
        status_kipas: false,
        status_pompa: false,
        status_lampu: false,
        state_kipas: "IDLE",
        state_pompa: "IDLE",
        state_lampu: "IDLE",
        timestamp: new Date().toISOString(),
    });

    const navigate = useNavigate();
    const socketRef = useRef<Socket | null>(null);
    const filterRef = useRef<string>(chartFilter);

    // Update ref setiap kali filter berubah
    useEffect(() => {
        filterRef.current = chartFilter;
    }, [chartFilter]);

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

    const loadHistory = (filter: string, ignoreRef: React.MutableRefObject<boolean>) => {
        // Cek Cache untuk hourly_5m
        if (filter === "hourly_5m" && chartCache.current[filter]) {
            setHistory(chartCache.current[filter]);
            return;
        }

        getTelemetry(filter)
            .then((res) => {
                if (ignoreRef && ignoreRef.current) return;
                const safeData = res || [];
                
                // Simpan ke cache jika mode hourly
                if (filter === "hourly_5m") {
                    chartCache.current[filter] = safeData;
                }
                
                setHistory(safeData);
                if (filter === "realtime_30m" && safeData.length > 0) {
                    setData(safeData[safeData.length - 1]);
                }
            })
            .catch((err) => console.error("History Error:", err));
    };

    useEffect(() => {
        // Hubungkan kembali jika sebelumnya sempat disconnect (akibat logout)
        const socket = io(import.meta.env.VITE_API_URL);
        socketRef.current = socket;

        socket.on("connect", () => setIsOnline(true));
        socket.on("disconnect", () => setIsOnline(false));

        socket.on("telemetry_live", (payload: TelemetryData) => {
            setData(payload);
            setHistory((prev) => {
                // Hanya tambahkan data baru jika sedang di mode realtime
                if (filterRef.current === "realtime_30m") {
                    const newHistory = [...prev, payload];
                    // Jika data lebih lama dari 30 menit, buang (filter)
                    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).getTime();
                    return newHistory.filter(d => new Date(d.timestamp).getTime() >= thirtyMinsAgo);
                }
                return prev; // Jika di mode hourly, biarkan saja chartnya statis
            });

            console.log("📩 Data Live via Backend Bridge:", payload);
        });

        socket.on("esp_status", (status) => {
            setIsEspOnline(status);
        });
        const statsInterval = setInterval(refreshStats, 5 * 60 * 1000);

        return () => {
            socket.disconnect();
            clearInterval(statsInterval);
        };
    }, []);

    useEffect(() => {
        const ignoreRef = { current: false };
        refreshStats();
        loadHistory(chartFilter, ignoreRef);
        return () => {
            ignoreRef.current = true;
        };
    }, [chartFilter]); // Hanya ambil data API, tidak mengganggu socket

    const handleControl = async (device: string, currentStatus: boolean) => {
        try {
            // Kita kirim status kebalikan dari yang sekarang (toggle)
            const newStatus = !currentStatus;

            // Panggil API Backend
            await sendControl(device, newStatus);

            // Update UI lokal sementara supaya terasa responsif (Optimistic Update)
            setData((prev) => ({
                ...prev,
                [`status_${device}`]: newStatus,
            }));

            console.log(`Mengirim perintah: ${device} -> ${newStatus}`);
        } catch (error: any) {
            // Jika error 401 (Unauthorized), paksa login ulang
            if (error.response?.status === 401) {
                alert("Sesi habis, silakan login kembali.");
                handleLogout();
            } else {
                alert("Gagal mengirim kontrol!");
            }
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8 space-y-8">
            {/* HEADER */}
            <DashboardHeader 
                isOnline={isOnline} 
                isEspOnline={isEspOnline} 
                onLogout={handleLogout} 
            />

            {/* ANALYTICS SECTION */}
            <AnalyticsGrid analytics={analytics} />

            {/* SENSOR GRID */}
            <SensorGrid data={data} />
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">
                        Grafik Riwayat Sensor
                    </h2>
                    <div className="flex bg-slate-700 p-1 rounded-lg">
                        <button
                            onClick={() => setChartFilter("realtime_30m")}
                            className={`px-4 py-1.5 rounded-md text-sm transition-all ${chartFilter === "realtime_30m"
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:text-white"
                                }`}
                        >
                            Realtime (30m)
                        </button>
                        <button
                            onClick={() => setChartFilter("hourly_5m")}
                            className={`px-4 py-1.5 rounded-md text-sm transition-all ${chartFilter === "hourly_5m"
                                    ? "bg-blue-600 text-white"
                                    : "text-slate-400 hover:text-white"
                                }`}
                        >
                            History 24j (5m)
                        </button>
                    </div>
                </div>

                <HistoryChart data={history} />
            </div>

            {/* SECTION: THRESHOLD SETTINGS */}
            <ThresholdSettings />

            <ControlPanel data={data} onControl={handleControl} />
        </div>
    );
};

export default Dashboard;
