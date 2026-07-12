import React from "react";
import { Download, LogOut } from "lucide-react";
import StatusBadge from "./StatusBadge";
import { backendUrl } from "../services/api";

interface DashboardHeaderProps {
    isOnline: boolean;
    isEspOnline: boolean;
    onLogout: () => void;
    nodes: string[];
    selectedNode: string;
    setSelectedNode: (node: string) => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ isOnline, isEspOnline, onLogout, nodes, selectedNode, setSelectedNode }) => {
    const getDownloadUrl = () => {
        const token = localStorage.getItem("app_token");
        const url = `${backendUrl}/api/telemetry/download?token=${token}`;
        window.open(url, "_blank");
    };

    return (
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-slate-800 p-4 sm:p-6 rounded-2xl shadow-xl">
            <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white">ZENITH Smart Farm</h1>
                <div className="flex items-center gap-2 mt-1">
                  <select
                    value={selectedNode}
                    onChange={(e) => setSelectedNode(e.target.value)}
                    className="bg-transparent text-slate-400 text-xs sm:text-sm font-semibold border-none outline-none focus:ring-0 cursor-pointer pr-5 appearance-none hover:text-white transition-colors"
                    style={{ 
                      backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, 
                      backgroundPosition: 'right center', 
                      backgroundSize: '1em', 
                      backgroundRepeat: 'no-repeat' 
                    }}
                  >
                    {nodes.map((node) => (
                      <option key={node} value={node} className="bg-slate-800 text-slate-200">
                        {node === "device0" ? "Greenhouse Zone A (device0)" : node}
                      </option>
                    ))}
                  </select>
                </div>
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
                    <span>Export CSV</span>
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
