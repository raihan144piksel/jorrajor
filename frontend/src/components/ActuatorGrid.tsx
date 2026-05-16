import React, { useState, useEffect } from "react";
import { Wind, Droplets, Lightbulb } from "lucide-react";
import type { TelemetryData, ThresholdSettings } from "../types";
import { getSettings } from "../services/api";

interface ActuatorGridProps {
    data: TelemetryData;
    onControl: (device: string, mode: number) => void;
}

const ActuatorGrid: React.FC<ActuatorGridProps> = ({ data, onControl }) => {
    const [thresholds, setThresholds] = useState<ThresholdSettings | null>(null);

    useEffect(() => {
        getSettings().then(setThresholds).catch(console.error);
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ActuatorCard
                title="Kipas Pendingin"
                device="kipas"
                icon={<Wind size={24} />}
                status={data.status_kipas}
                state={data.state_kipas}
                color="border-cyan-500"
                iconColor="text-cyan-500"
                activeBg="bg-cyan-500"
                onControl={onControl}
                threshold={thresholds?.temp_threshold ? `> ${thresholds.temp_threshold}°C` : undefined}
            />
            <ActuatorCard
                title="Pompa Air"
                device="pompa"
                icon={<Droplets size={24} />}
                status={data.status_pompa}
                state={data.state_pompa}
                color="border-blue-500"
                iconColor="text-blue-500"
                activeBg="bg-blue-500"
                onControl={onControl}
                threshold={thresholds?.hum_threshold ? `< ${thresholds.hum_threshold}%` : undefined}
            />
            <ActuatorCard
                title="Lampu UV"
                device="lampu"
                icon={<Lightbulb size={24} />}
                status={data.status_lampu}
                state={data.state_lampu}
                color="border-yellow-500"
                iconColor="text-yellow-500"
                activeBg="bg-yellow-500"
                onControl={onControl}
                threshold={thresholds?.light_threshold ? `< ${thresholds.light_threshold}%` : undefined}
            />
        </div>
    );
};

interface ActuatorCardProps {
    title: string;
    device: string;
    icon: React.ReactNode;
    status: boolean;
    state: string;
    color: string;
    iconColor: string;
    activeBg: string;
    onControl: (device: string, mode: number) => void;
    threshold?: string;
}

const ActuatorCard: React.FC<ActuatorCardProps> = ({ title, device, icon, status, state, color, iconColor, activeBg, onControl, threshold }) => {
    const isManual = state === "MANUAL";
    const currentMode = isManual ? (status ? 1 : 2) : 0;
    
    return (
        <div className={`p-6 rounded-2xl bg-slate-800 border-l-4 ${color} shadow-lg transition-all`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
                        {title}
                        {threshold && <span className="text-[10px] text-slate-500 lowercase bg-slate-900/50 px-2 py-0.5 rounded-full border border-slate-700/50">(Auto: {threshold})</span>}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${status ? `${activeBg} text-white shadow-lg` : 'bg-slate-700 text-slate-400'}`}>
                            {status ? "ON" : "OFF"}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-700">
                            {state || "UNKNOWN"}
                        </span>
                    </div>
                </div>
                <div className={`p-3 rounded-lg transition-colors duration-500 ${status ? `${activeBg} text-white shadow-lg shadow-${activeBg.split('-')[1]}-500/30` : `bg-slate-700 ${iconColor}`}`}>
                    {icon}
                </div>
            </div>
            
            <div className="mt-6 flex bg-slate-900/80 rounded-lg p-1 border border-slate-700/50">
                <button 
                   onClick={() => onControl(device, 0)}
                   className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${currentMode === 0 ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
                >
                   Auto
                </button>
                <button 
                   onClick={() => onControl(device, 1)}
                   className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${currentMode === 1 ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
                >
                   ON
                </button>
                <button 
                   onClick={() => onControl(device, 2)}
                   className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider ${currentMode === 2 ? 'bg-red-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-300'}`}
                >
                   OFF
                </button>
            </div>
        </div>
    );
};

export default ActuatorGrid;
