import React from "react";
import { Download, LogOut } from "lucide-react";
import StatusBadge from "./StatusBadge";

interface DashboardHeaderProps {
    isOnline: boolean;
    isEspOnline: boolean;
    onLogout: () => void;
    activeRange: string;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ isOnline, isEspOnline, onLogout, activeRange }) => {
    const getDownloadUrl = () => {
        const token = localStorage.getItem("app_token");
        const baseUrl = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
        const url = `${baseUrl}/api/telemetry/download?token=${token}&range=${activeRange}`;
        window.open(url, "_blank");
    };

    return (
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">SEMAI Smart Farm</h1>
                <p className="text-slate-400 text-xs sm:text-sm">
                    Greenhouse Zone A - Live Monitoring
                </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full xl:w-auto">
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

            <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 w-full xl:w-auto justify-start xl:justify-end">
                <button
                    onClick={getDownloadUrl}
                    className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all active:scale-95 text-sm sm:text-base"
                >
                    <Download size={18} />
                    <span>Export ({activeRange})</span>
                </button>
                <button
                    onClick={onLogout}
                    className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg border border-red-600/50 transition-all text-sm sm:text-base"
                >
                    <LogOut size={18} />
                    <span>Keluar</span>
                </button>
            </div>
        </header>
    );
};

export default DashboardHeader;
