import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const HistoryChart = ({ data }) => {

  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-800 p-6 rounded-2xl shadow-xl h-[400px] flex items-center justify-center">
        <p className="text-slate-400">Menunggu data sensor...</p>
      </div>
    );
  }

  // Balik urutan data agar yang terbaru ada di kanan
  const chartData = [...data].reverse();

  return (
    // 2. Gunakan min-width agar ResponsiveContainer punya acuan
    <div className="bg-slate-800 p-6 rounded-2xl shadow-xl h-[400px] w-full min-w-0">
      <h2 className="text-xl font-semibold mb-6 text-slate-200">Tren Sensor (20 Data Terakhir)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorSuhu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorTanah" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorCahaya" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis stroke="#64748b" fontSize={12} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Legend verticalAlign="top" height={36}/>
          <Area 
            type="monotone" 
            dataKey="suhu" 
            name="Suhu (°C)" 
            stroke="#f97316" 
            fillOpacity={1} 
            fill="url(#colorSuhu)" 
            strokeWidth={3}
          />
          <Area 
            type="monotone" 
            dataKey="tanah" 
            name="Tanah (%)" 
            stroke="#3b82f6" 
            fillOpacity={1} 
            fill="url(#colorTanah)" 
            strokeWidth={3}
          />
          <Area
            type="monotone"
            dataKey="cahaya"
            name="Cahaya"
            stroke="#eab308"
            fill="url(#colorCahaya)"
            strokeWidth={3}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HistoryChart;