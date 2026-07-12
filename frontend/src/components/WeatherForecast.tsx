import React, { useState, useEffect, useCallback } from "react";
import { fetchWeatherApi } from "openmeteo";
import { 
  Cloud, 
  CloudDrizzle, 
  CloudFog, 
  CloudLightning, 
  CloudRain, 
  CloudSnow, 
  Sun, 
  MapPin,
  Settings,
  Navigation,
  RefreshCw,
  Save
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ComposedChart,
  Bar
} from "recharts";

interface WeatherHourlyPoint {
  time: Date;
  temp: number;
  humidity: number;
  apparent: number;
  wind: number;
  pressure: number;
  precip: number;
  code: number;
  soil: number;
}

interface WeatherDailyPoint {
  date: Date;
  maxTemp: number;
  minTemp: number;
  code: number;
}

interface WeatherData {
  hourly: WeatherHourlyPoint[];
  daily: WeatherDailyPoint[];
  lastUpdated: string;
}

interface Coords {
  lat: number;
  lon: number;
}

const CACHE_KEY = "weather_cache_data";
const CACHE_DURATION = 60 * 60 * 1000; // 1 Jam

// ============================================================
// Fungsi: getWeatherIcon(code: number)
// Deskripsi: Memetakan WMO Weather Codes (kode cuaca standar WMO) ke komponen ikon React Lucide.
// ============================================================
const getWeatherIcon = (code: number) => {
  if (code === 0) return <Sun className="text-yellow-400" />;
  if (code <= 3) return <Cloud className="text-slate-400" />;
  if (code <= 48) return <CloudFog className="text-slate-500" />;
  if (code <= 57) return <CloudDrizzle className="text-blue-300" />;
  if (code <= 67) return <CloudRain className="text-blue-500" />;
  if (code <= 77) return <CloudSnow className="text-blue-200" />;
  if (code <= 82) return <CloudRain className="text-blue-600" />;
  if (code <= 99) return <CloudLightning className="text-purple-500" />;
  return <Sun className="text-yellow-400" />;
};

const WeatherForecast: React.FC = () => {
  const [coords, setCoords] = useState<Coords>(() => {
    const saved = localStorage.getItem("weather_coords");
    return saved ? JSON.parse(saved) : { lat: -6.2356, lon: 106.7452 };
  });

  // Local draft state for inputs to prevent multiple API calls while typing
  const [draftCoords, setDraftCoords] = useState<Coords>(coords);

  const [showSettings, setShowSettings] = useState(false);
  const [forecastData, setForecastData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // ==========================================
  // PENARIKAN API CUACA (OPEN-METEO): Sinkronisasi Data Cuaca 7 Hari
  // ==========================================
  // React hook useEffect dijalankan setiap koordinat (coords) berubah atau dipicu secara manual (refreshTrigger).
  useEffect(() => {
    let ignore = false;
    const isManualRefresh = refreshTrigger > 0;

    const runFetch = async () => {
      setLoading(true);
      try {
        // --- 1. MEKANISME CACHING ---
        // Jika bukan refresh manual, periksa apakah data cuaca tersimpan di localStorage.
        // Cache valid selama 1 jam (CACHE_DURATION) untuk menghindari pembatasan limit API Open-Meteo.
        if (!isManualRefresh) {
          const cached = localStorage.getItem(CACHE_KEY);
          if (cached) {
            const parsed = JSON.parse(cached);
            const age = Date.now() - new Date(parsed.lastUpdated).getTime();
            if (age < CACHE_DURATION) {
              const restoredData: WeatherData = {
                ...parsed,
                hourly: parsed.hourly.map((h: WeatherHourlyPoint) => ({ ...h, time: new Date(h.time) })),
                daily: parsed.daily.map((d: WeatherDailyPoint) => ({ ...d, date: new Date(d.date) }))
              };
              if (!ignore) {
                setForecastData(restoredData);
                setLoading(false);
              }
              return;
            }
          }
        }

        // --- 2. PENYIAPAN PARAMETER API OPEN-METEO ---
        // Meminta data cuaca per-jam (hourly) seperti suhu udara, kelembapan, kecepatan angin, curah hujan,
        // dan kelembapan tanah lapisan atas (soil_moisture_0_to_1cm).
        const params = {
          latitude: coords.lat,
          longitude: coords.lon,
          hourly: [
            "temperature_2m", 
            "relative_humidity_2m", 
            "apparent_temperature", 
            "wind_speed_10m", 
            "surface_pressure", 
            "precipitation", 
            "weather_code", 
            "soil_moisture_0_to_1cm"
          ],
          timezone: "auto",
          forecast_days: 7,
        };
        
        // --- 3. MEMANGGIL API OPEN-METEO ---
        const url = "https://api.open-meteo.com/v1/forecast";
        const responses = await fetchWeatherApi(url, params);
        const response = responses[0]!;
        const hourly = response.hourly()!;

        // --- 4. FORMATTING / PARSING RESPON API ---
        // Memetakan array hasil respons API biner Open-Meteo ke array objek JavaScript (WeatherHourlyPoint)
        const dataPoints: WeatherHourlyPoint[] = Array.from(
          { length: (Number(hourly.timeEnd()) - Number(hourly.time())) / hourly.interval() },
          (_, i) => ({
            time: new Date((Number(hourly.time()) + i * hourly.interval()) * 1000),
            temp: hourly.variables(0)!.valuesArray()![i] || 0,
            humidity: hourly.variables(1)!.valuesArray()![i] || 0,
            apparent: hourly.variables(2)!.valuesArray()![i] || 0,
            wind: hourly.variables(3)!.valuesArray()![i] || 0,
            pressure: hourly.variables(4)!.valuesArray()![i] || 0,
            precip: hourly.variables(5)!.valuesArray()![i] || 0,
            code: hourly.variables(6)!.valuesArray()![i] || 0,
            soil: hourly.variables(7)!.valuesArray()![i] || 0,
          })
        );

        // Agregasi data per-jam menjadi data harian (daily) untuk ramalan cuaca ringkas 7 hari
        const daily: WeatherDailyPoint[] = [];
        for (let i = 0; i < 7; i++) {
          const dayData = dataPoints.slice(i * 24, (i + 1) * 24);
          daily.push({
            date: dayData[0]!.time,
            maxTemp: Math.max(...dayData.map(d => d.temp)),
            minTemp: Math.min(...dayData.map(d => d.temp)),
            code: dayData[12]!.code, 
          });
        }

        const freshData: WeatherData = { hourly: dataPoints, daily, lastUpdated: new Date().toISOString() };
        
        // Simpan data terbaru ke state dan perbarui cache localStorage
        if (!ignore) {
          setForecastData(freshData);
          localStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
        }
      } catch (err) {
        console.error("Weather Fetch Error:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    runFetch();
    localStorage.setItem("weather_coords", JSON.stringify(coords));

    return () => { ignore = true; };
  }, [coords, refreshTrigger]);

  // ============================================================
  // Fungsi: handleManualRefresh()
  // Deskripsi: Memaksa pembaruan data cuaca dari API secara instan (mengabaikan cache).
  // ============================================================
  const handleManualRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  // ============================================================
  // Fungsi: applyNewCoords()
  // Deskripsi: Menerapkan koordinat baru yang diinput secara manual oleh user.
  // ============================================================
  const applyNewCoords = () => {
    setCoords(draftCoords);
    setShowSettings(false);
    setRefreshTrigger(prev => prev + 1); // Memaksa refresh data baru untuk lokasi baru
  };

  // ============================================================
  // Fungsi: handleUseCurrentLocation()
  // Deskripsi: Meminta izin akses lokasi GPS browser (Geolocation API) untuk mendapatkan koordinat user.
  // ============================================================
  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const newCoords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setDraftCoords(newCoords);
        setCoords(newCoords);
        setShowSettings(false);
        setRefreshTrigger(prev => prev + 1);
      });
    }
  };

  const chartTheme = {
    stroke: "#64748b",
    grid: "#334155",
    text: "#94a3b8",
  };

  // ============================================================
  // Fungsi: tooltipFormatter()
  // Deskripsi: Memformat tampilan label & satuan pada tooltip grafik interaktif (Recharts).
  // ============================================================
  const tooltipFormatter = useCallback((value: unknown, name: unknown): [React.ReactNode, string] => {
    const val = Number(value || 0);
    const nameStr = String(name || "");
    
    if (nameStr.includes("Suhu") || nameStr.includes("Terasa")) return [`${val.toFixed(1)}°C`, nameStr];
    if (nameStr.includes("Kelembapan") || nameStr.includes("Tanah")) return [`${Math.round(val * (nameStr.includes("Tanah") ? 100 : 1))}%`, nameStr];
    if (nameStr.includes("Angin")) return [`${val.toFixed(1)} km/h`, nameStr];
    if (nameStr.includes("Tekanan")) return [`${Math.round(val)} hPa`, nameStr];
    if (nameStr.includes("Hujan")) return [`${val.toFixed(1)} mm`, nameStr];
    
    return [String(value), nameStr];
  }, []);

  if (loading && !forecastData) {
    return (
      <div className="bg-slate-800/50 animate-pulse rounded-2xl h-64 flex items-center justify-center">
        <p className="text-slate-400">Memuat prakiraan cuaca...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Cloud className="text-blue-400" /> Analisis Prakiraan 7-Hari
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-400 text-xs flex items-center gap-1">
              <MapPin size={12} /> {coords.lat.toFixed(2)}, {coords.lon.toFixed(2)}
            </p>
            {forecastData && (
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-tight">
                Diperbarui: {new Date(forecastData.lastUpdated).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={handleManualRefresh}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
          </button>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-all ${showSettings ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-4 shadow-2xl animate-in zoom-in-95 duration-200">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Latitude</label>
            <input 
              type="number" 
              value={draftCoords.lat} 
              onChange={(e) => setDraftCoords({...draftCoords, lat: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1 uppercase">Longitude</label>
            <input 
              type="number" 
              value={draftCoords.lon} 
              onChange={(e) => setDraftCoords({...draftCoords, lon: parseFloat(e.target.value) || 0})}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-end gap-2">
            <button 
              onClick={handleUseCurrentLocation}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
            >
              <Navigation size={14} /> Lokasi Saya
            </button>
            <button 
              onClick={applyNewCoords}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
            >
              <Save size={14} /> Simpan & Terapkan
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {forecastData?.daily.map((day, i) => (
          <div 
            key={i}
            className={`p-4 rounded-2xl border transition-all flex flex-col items-center text-center gap-2 min-w-25
              ${i === 0 ? "bg-blue-600/10 border-blue-500/50" : "bg-slate-800/40 border-slate-700/50"}
            `}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              {i === 0 ? "Hari Ini" : day.date.toLocaleDateString("id-ID", { weekday: "short" })}
            </span>
            <div className="my-1">
              {getWeatherIcon(day.code)}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-white">{Math.round(day.maxTemp)}°</span>
              <span className="text-xs text-slate-500">{Math.round(day.minTemp)}°</span>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 bg-slate-900/50 p-4 md:p-6 rounded-4xl border border-slate-800 shadow-inner">
        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-2">Atmosphere (Temp & Humidity)</h4>
          <div className="h-48 w-full bg-slate-800/30 rounded-2xl p-2 border border-slate-700/30 min-w-0">
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={forecastData?.hourly} syncId="weatherSync">
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis yAxisId="left" stroke={chartTheme.stroke} fontSize={10} domain={['auto', 'auto']} unit="°" />
                <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={10} domain={[0, 100]} unit="%" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px", fontSize: "12px" }}
                  labelFormatter={(val) => new Date(val).toLocaleString("id-ID", { weekday: 'short', hour: "2-digit", minute: "2-digit" })}
                  formatter={tooltipFormatter}
                />
                <Area yAxisId="left" type="monotone" dataKey="temp" stroke="#f97316" fill="#f97316" fillOpacity={0.1} strokeWidth={2} name="Suhu" />
                <Area yAxisId="left" type="monotone" dataKey="apparent" stroke="#f97316" fill="transparent" strokeDasharray="4 4" name="Terasa Seperti" />
                <Area yAxisId="right" type="monotone" dataKey="humidity" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.05} name="Kelembapan" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-2">Environment (Wind & Soil)</h4>
          <div className="h-48 w-full bg-slate-800/30 rounded-2xl p-2 border border-slate-700/30 min-w-0">
            <ResponsiveContainer width="100%" height={192}>
              <AreaChart data={forecastData?.hourly} syncId="weatherSync">
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis yAxisId="wind" stroke="#10b981" fontSize={10} unit="km" />
                <YAxis yAxisId="soil" orientation="right" stroke="#fbbf24" fontSize={10} domain={[0, 1]} unit="m3" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px", fontSize: "12px" }} 
                  labelFormatter={(val) => new Date(val).toLocaleString("id-ID", { weekday: 'short', hour: "2-digit", minute: "2-digit" })}
                  formatter={tooltipFormatter}
                />
                <Area yAxisId="wind" type="monotone" dataKey="wind" stroke="#10b981" fill="#10b981" fillOpacity={0.1} name="Angin" />
                <Area yAxisId="soil" type="monotone" dataKey="soil" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.1} name="Kelembapan Tanah" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] ml-2">Water & Pressure</h4>
          <div className="h-48 w-full bg-slate-800/30 rounded-2xl p-2 border border-slate-700/30 min-w-0">
            <ResponsiveContainer width="100%" height={192}>
              <ComposedChart data={forecastData?.hourly} syncId="weatherSync">
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                <XAxis 
                  dataKey="time" 
                  tickFormatter={(val) => new Date(val).toLocaleDateString("id-ID", { weekday: 'short' })} 
                  stroke={chartTheme.stroke} 
                  fontSize={10}
                  interval={23}
                />
                <YAxis yAxisId="precip" stroke="#3b82f6" fontSize={10} unit="mm" />
                <YAxis yAxisId="press" orientation="right" stroke="#a855f7" fontSize={10} domain={['auto', 'auto']} unit="hPa" />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", border: "none", borderRadius: "12px", fontSize: "12px" }} 
                  labelFormatter={(val) => new Date(val).toLocaleString("id-ID", { weekday: 'short', hour: "2-digit", minute: "2-digit" })}
                  formatter={tooltipFormatter}
                />
                <Bar yAxisId="precip" dataKey="precip" fill="#3b82f6" name="Hujan" radius={[2, 2, 0, 0]} />
                <Area yAxisId="press" type="monotone" dataKey="pressure" stroke="#a855f7" fill="#a855f7" fillOpacity={0.05} name="Tekanan" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherForecast;
