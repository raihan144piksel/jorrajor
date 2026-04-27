import React, { useState, useEffect, useRef } from 'react';
import { Thermometer, Droplets, Sun, Download } from 'lucide-react';
import { io } from 'socket.io-client';
import { getTelemetry, getAnalytics, sendControl, getDownloadUrl } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

import SensorCard from '../components/SensorCard';
import HistoryChart from '../components/HistoryChart';
import ControlPanel from '../components/ControlPanel';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';

const Dashboard = () => {

    const [liveData, setLiveData] = useState(null); // data sensor realtime
    const [history, setHistory] = useState([]);
    const [isOnline, setIsOnline] = useState(false); // Status Server
    const [isEspOnline, setIsEspOnline] = useState(false); // Status Alat
    const [analytics, setAnalytics] = useState(null);
    const [chartFilter, setChartFilter] = useState('20');

    // Fungsi internal untuk ambil stats terbaru
    const refreshStats = () => {
        getAnalytics().then(res => setAnalytics(res));
    };

    const [data, setData] = useState({
        suhu: 0,
        kelembapan_udara: 0,
        tanah: 0,
        cahaya: 0,
        status_kipas: false,
        status_pompa: false,
        status_lampu: false,
        state_kipas: 'IDLE',
        state_pompa: 'IDLE',
        state_lampu: 'IDLE'
    });

    // Fungsi untuk ambil data history
    const loadHistory = (filter) => {
        getTelemetry(filter).then(res => {
            if (res && res.length > 0) {
                setHistory(res);
                if (filter === '20') setData(res[res.length - 1]);
            }
        });
    };

    const navigate = useNavigate();
    const socketRef = useRef(null);

    const handleLogout = () => {
        localStorage.removeItem('app_token');
        socketRef.current?.disconnect(); // ✅ Akses via ref
        navigate('/login');
    };


    useEffect(() => {
        // Hubungkan kembali jika sebelumnya sempat disconnect (akibat logout)
        const socket = io(import.meta.env.VITE_API_URL);
        socketRef.current = socket;

        socket.on('connect', () => setIsOnline(true));
        socket.on('disconnect', () => setIsOnline(false));


        socket.on('telemetry_live', (payload) => {
            setLiveData(payload);
            setData(payload);
            console.log('📩 Data Live via Backend Bridge:', payload);
            refreshStats();
        });

        const loadHistory = (filter) => {
            getTelemetry(filter).then(res => {
                if (res?.length > 0) {
                    setHistoryData(res);
                    if (filter === '20') setData(res[res.length - 1]);
                }
            });
        };


        socket.on('esp_status', (status) => {
            setIsEspOnline(status);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    useEffect(() => {
        refreshStats();
        loadHistory(chartFilter);
    }, [chartFilter]); // Hanya ambil data API, tidak mengganggu socket

    const handleControl = async (device, currentStatus) => {
        try {
            // Kita kirim status kebalikan dari yang sekarang (toggle)
            const newStatus = !currentStatus;

            // Panggil API Backend
            await sendControl(device, newStatus);

            // Update UI lokal sementara supaya terasa responsif (Optimistic Update)
            setData(prev => ({
                ...prev,
                [`status_${device}`]: newStatus
            }));

            console.log(`Mengirim perintah: ${device} -> ${newStatus}`);
        } catch (error) {
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
            <header className="flex justify-between items-center bg-slate-800 p-6 rounded-2xl shadow-xl">
                <div>
                    <h1 className="text-2xl font-bold text-white">SEMAI Smart Farm</h1>
                    <p className="text-slate-400 text-sm">Greenhouse Zone A - Live Monitoring</p>
                </div>
                {/* BAGIAN STATUS */}
                <div className="flex gap-4">
                    <StatusBadge
                        label="Server Status"
                        status={isOnline}
                        activeText="CONNECTED"
                        activeColor="green"
                        pulse={true}
                    />
                    <StatusBadge
                        label="Device Status (ESP32)"
                        status={isEspOnline}
                        activeText="HARDWARE ACTIVE"
                        activeColor="blue"
                        pulse={true}
                    />
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={getDownloadUrl} // Panggil fungsi unduhan di sini
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all active:scale-95"
                    >
                        <Download size={18} />
                        <span>Export</span>
                    </button>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg border border-red-600/50 transition-all"
                    >
                        <LogOut size={18} /> Logout
                    </button>
                </div>
            </header>

            {/* ANALYTICS SECTION */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Kartu 1: Rata-rata Suhu */}
                <StatCard
                    label="Rata-rata Suhu"
                    value={`${analytics?.rataSuhu || '--'}°C`}
                    color="border-orange-500"
                />

                {/* Kartu 2: Rentang Suhu (Ganti Estimasi Air) */}
                <StatCard
                    label="Suhu Terpanas / Terdingin"
                    value={`${analytics?.maxSuhu || '--'}° / ${analytics?.minSuhu || '--'}°`}
                    subValue="Rekor suhu 24 jam terakhir"
                    color="border-red-500"
                />

                {/* Kartu 3: Titik Terkering */}
                <StatCard
                    label="Tanah Paling Kering"
                    value={`${analytics?.nilaiTanahKering || '--'}%`}
                    subValue={`Terjadi jam ${analytics?.jamTanahKering || '--'}`}
                    color="border-emerald-500"
                />

                {/* Kartu 4: Uptime Sistem (Ganti Sistem Optimal) */}
                <StatCard
                    label="Log Data (24j)"
                    value={`${analytics?.totalMenit || '--'} Data`}
                    subValue="Total data yang tersimpan"
                    color="border-blue-500"
                />
            </div>

            {/* SENSOR GRID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <SensorCard
                    title="Suhu Udara"
                    value={data.suhu}
                    unit="°C"
                    icon={Thermometer}
                    color="border-orange-500"
                    state={data.state_kipas}
                    iconColor="text-orange-500"
                />
                <SensorCard
                    title="Kelembapan Udara"
                    value={data.kelembapan_udara}
                    unit="%"
                    icon={Droplets}
                    color="border-emerald-500"
                    state={data.state_pompa}
                    iconColor="text-emerald-500"
                />
                <SensorCard
                    title="Kelembapan Tanah"
                    value={data.tanah}
                    unit="%"
                    icon={Droplets}
                    color="border-blue-500"
                    state={data.state_pompa}
                    iconColor="text-blue-500"
                />
                <SensorCard
                    title="Intensitas Cahaya"
                    value={data.cahaya}
                    unit="%"
                    icon={Sun}
                    color="border-yellow-500"
                    state={data.state_lampu}
                    iconColor="text-yellow-500"
                />
            </div>
            <div className="bg-slate-800 p-6 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">Grafik Riwayat Sensor</h2>
                    <div className="flex bg-slate-700 p-1 rounded-lg">
                        <button
                            onClick={() => setChartFilter('20')}
                            className={`px-4 py-1.5 rounded-md text-sm transition-all ${chartFilter === '20' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            20 Data Terakhir
                        </button>
                        <button
                            onClick={() => setChartFilter('1h')}
                            className={`px-4 py-1.5 rounded-md text-sm transition-all ${chartFilter === '1h' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            1 Jam Terakhir
                        </button>
                    </div>
                </div>

                <HistoryChart data={history} />
            </div>

            <ControlPanel data={data} onControl={handleControl} />
        </div>
    );
};

export default Dashboard;