import React, { useState, useEffect } from 'react';
import { Thermometer, Droplets, Sun, Download, Power } from 'lucide-react';
import { getTelemetry, sendControl, getDownloadUrl } from './services/api';
import SensorCard from './components/SensorCard';
import HistoryChart from './components/HistoryChart';
import ControlPanel from './components/ControlPanel';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_API_URL);

function App() {
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

  const [history, setHistory] = useState([]);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // 1. Ambil data terakhir dari DB saat web dibuka
    getTelemetry().then(res => {
      if (res.data.length > 0) {
        setHistory(res.data);
        setData(res.data[0]); // Ambil data paling baru dari DB
      }
    });

    // 2. Ganti MQTT dengan Socket.io
    socket.on('telemetry_live', (payload) => {
      console.log('📩 Data Live via Backend Bridge:', payload);
      setData(payload);
      setHistory(prev => [payload, ...prev].slice(0, 20));
      setIsOnline(true);
    });

    // Logika jika koneksi ke backend terputus
    socket.on('connect', () => setIsOnline(true));
    socket.on('disconnect', () => setIsOnline(false));

    return () => {
      socket.off('telemetry_live');
    };
  }, []);

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
      console.error("Gagal mengirim kontrol:", error);
      alert("Koneksi ke backend bermasalah!");
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
        <span className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
          {isOnline ? 'LIVE' : 'OFFLINE'}
        </span>
        <a
          href={getDownloadUrl()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <Download size={18} /> Export CSV
        </a>
      </header>

      {/* SENSOR GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SensorCard
          title="Suhu Udara"
          value={data.suhu}
          unit="°C"
          icon={Thermometer}
          color="border-orange-500"
          state={data.state_kipas}
        />
        <SensorCard
          title="Kelembapan Tanah"
          value={data.tanah}
          unit="%"
          icon={Droplets}
          color="border-blue-500"
          state={data.state_pompa}
        />
        <SensorCard
          title="Intensitas Cahaya"
          value={data.cahaya}
          unit="%"
          icon={Sun}
          color="border-yellow-500"
          state={data.state_lampu}
        />
      </div>

      <HistoryChart data={history} />

      <ControlPanel data={data} onControl={handleControl} />
    </div>
  );
}

export default App;