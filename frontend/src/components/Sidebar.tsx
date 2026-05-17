import React, { useState } from "react";
import { 
  LayoutDashboard, 
  BarChart3, 
  CloudSun, 
  Settings, 
  LogOut,
  Leaf,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const [isFolded, setIsFolded] = useState(false);

  const menuItems = [
    { id: "overview", label: "Ringkasan", icon: <LayoutDashboard size={22} /> },
    { id: "analytics", label: "Analitik", icon: <BarChart3 size={22} /> },
    { id: "weather", label: "Cuaca", icon: <CloudSun size={22} /> },
    { id: "settings", label: "Konfigurasi", icon: <Settings size={22} /> },
  ];

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 h-screen sticky top-0 transition-all duration-300 ${isFolded ? "w-20" : "w-64"}`}>
        <div className={`p-8 flex items-center gap-3 ${isFolded ? "justify-center px-0" : ""}`}>
          <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-500/20 shrink-0">
            <Leaf className="text-white" size={24} />
          </div>
          {!isFolded && <h1 className="text-xl font-bold text-white tracking-tight animate-in fade-in duration-300 truncate">RumahIjo</h1>}
        </div>

        <nav className={`flex-1 space-y-2 mt-4 ${isFolded ? "px-2" : "px-4"}`}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center rounded-xl transition-all duration-200 group
                ${isFolded ? "justify-center p-3" : "gap-3 px-4 py-3.5"}
                ${activeTab === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"}
              `}
              title={isFolded ? item.label : undefined}
            >
              <div className={`${activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-blue-400"} transition-colors shrink-0`}>
                {item.icon}
              </div>
              {!isFolded && <span className="font-medium animate-in fade-in duration-300 truncate">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
          <button
            onClick={() => setIsFolded(!isFolded)}
            className={`w-full flex items-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all duration-200
               ${isFolded ? "justify-center p-3" : "gap-3 px-4 py-3.5"}
            `}
            title={isFolded ? "Buka Sidebar" : "Tutup Sidebar"}
          >
            <div className="shrink-0">
              {isFolded ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
            </div>
            {!isFolded && <span className="font-medium animate-in fade-in duration-300 truncate">Sembunyikan</span>}
          </button>
          
          <button
            onClick={onLogout}
            className={`w-full flex items-center rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200
               ${isFolded ? "justify-center p-3" : "gap-3 px-4 py-3.5"}
            `}
            title={isFolded ? "Keluar" : undefined}
          >
            <div className="shrink-0"><LogOut size={22} /></div>
            {!isFolded && <span className="font-medium animate-in fade-in duration-300 truncate">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800 px-2 py-3 flex justify-around items-center">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-all
              ${activeTab === item.id ? "text-blue-400 scale-110" : "text-slate-500"}
            `}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500 hover:text-red-400 transition-colors"
        >
          <LogOut size={22} />
          <span className="text-[10px] font-medium">Keluar</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;
