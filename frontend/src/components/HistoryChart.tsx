import React from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { TelemetryData } from "../types";

interface HistoryChartProps {
    data: TelemetryData[];
}

const HistoryChart: React.FC<HistoryChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <div className="w-full h-64 sm:h-[350px] flex items-center justify-center">
                <p className="text-slate-400">Menunggu data sensor...</p>
            </div>
        );
    }

    return (
        <div className="w-full min-w-0">
            <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient
                            id="colorSuhu"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="#f97316"
                                stopOpacity={0.3}
                            />
                            <stop
                                offset="95%"
                                stopColor="#f97316"
                                stopOpacity={0}
                            />
                        </linearGradient>
                        <linearGradient
                            id="colorTanah"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="#3b82f6"
                                stopOpacity={0.3}
                            />
                            <stop
                                offset="95%"
                                stopColor="#3b82f6"
                                stopOpacity={0}
                            />
                        </linearGradient>
                        <linearGradient
                            id="colorCahaya"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="#eab308"
                                stopOpacity={0.3}
                            />
                            <stop
                                offset="95%"
                                stopColor="#eab308"
                                stopOpacity={0}
                            />
                        </linearGradient>
                        <linearGradient
                            id="colorKelembapan"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                        >
                            <stop
                                offset="5%"
                                stopColor="#10b981"
                                stopOpacity={0.3}
                            />
                            <stop
                                offset="95%"
                                stopColor="#10b981"
                                stopOpacity={0}
                            />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#334155"
                        vertical={false}
                    />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(time) =>
                            new Date(time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                            })
                        }
                        stroke="#64748b"
                        fontSize={10}
                        interval="preserveStartEnd"
                        minTickGap={30} // Mencegah label bertumpuk
                    />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip
                        labelFormatter={(label) =>
                            new Date(label).toLocaleString("id-ID", {
                                dateStyle: "short",
                                timeStyle: "short",
                            })
                        }
                        contentStyle={{
                            backgroundColor: "#1e293b",
                            border: "none",
                            borderRadius: "8px",
                            color: "#fff",
                        }}
                        itemStyle={{ fontSize: "12px" }}
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Area
                        type="monotone" // Ini yang bikin garis melengkung halus
                        dataKey="suhu"
                        name="Suhu (°C)"
                        stroke="#f97316"
                        fillOpacity={1}
                        fill="url(#colorSuhu)"
                        strokeWidth={3}
                        connectNulls={true} // Menghubungkan garis jika ada data bolong
                        animationDuration={1500}
                    />
                    <Area
                        type="monotone"
                        dataKey="tanah"
                        name="Tanah (%)"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorTanah)"
                        strokeWidth={3}
                        connectNulls={true}
                        animationDuration={1500}
                    />
                    <Area
                        type="monotone"
                        dataKey="cahaya"
                        name="Cahaya (%)"
                        stroke="#eab308"
                        fill="url(#colorCahaya)"
                        strokeWidth={3}
                        connectNulls={true}
                        animationDuration={1500}
                    />
                    <Area
                        type="monotone"
                        dataKey="kelembapan_udara"
                        name="Kelembapan Udara (%)"
                        stroke="#10b981"
                        fill="url(#colorKelembapan)"
                        strokeWidth={3}
                        connectNulls={true}
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default HistoryChart;
