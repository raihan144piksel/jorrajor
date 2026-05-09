import React from "react";
import { 
  LayoutDashboard, 
  BarChart3, 
  CloudSun, 
  Settings, 
  LogOut,
  Leaf
} from "lucide-react";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  const menuItems = [
    { id: "overview", label: "Ringkasan", icon: <LayoutDashboard size={22} /> },
    { id: "analytics", label: "Analitik", icon: <BarChart3 size={22} /> },
    { id: "weather", label: "Cuaca", icon: <CloudSun size={22} /> },
    { id: "settings", label: "Konfigurasi", icon: <Settings size={22} /> },
  ];

  return (
    <>
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800 h-screen sticky top-0">
        <div className="p-8 flex items-center gap-3">
          <div className="bg-emerald-500 p-2 rounded-xl shadow-lg shadow-emerald-500/20">
            <Leaf className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">RumahIjo</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group
                ${activeTab === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"}
              `}
            >
              <div className={`${activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-blue-400"} transition-colors`}>
                {item.icon}
              </div>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
          >
            <LogOut size={22} />
            <span className="font-medium">Keluar</span>
          </button>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-t border-slate-800 px-2 py-3 flex justify-around items-center">
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
          className="flex flex-col items-center gap-1 px-3 py-1 text-slate-500"
        >
          <LogOut size={22} />
          <span className="text-[10px] font-medium">Out</span>
        </button>
      </div>
    </>
  );
};

export default Sidebar;
