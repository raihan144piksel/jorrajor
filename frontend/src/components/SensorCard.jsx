import React from 'react';

const SensorCard = ({ title, value, unit, icon: Icon, color, state }) => {
  return (
    <div className={`p-6 rounded-2xl bg-slate-800 border-l-4 ${color} shadow-lg transition-all hover:scale-105`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold mt-1 text-white">
            {value} <span className="text-lg font-normal text-slate-500">{unit}</span>
          </h3>
        </div>
        <div className={`p-3 rounded-lg bg-slate-700 ${color.replace('border-', 'text-')}`}>
          <Icon size={24} />
        </div>
      </div>
      
      {/* Indikator State (IDLE, TRIGGERED, ON, COOLDOWN) */}
      <div className="mt-4 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full animate-pulse ${state === 'ON' ? 'bg-green-500' : 'bg-slate-500'}`}></span>
        <p className="text-xs font-semibold text-slate-400 italic">
          STATUS: <span className={state === 'ON' ? 'text-green-400' : 'text-slate-300'}>{state}</span>
        </p>
      </div>
    </div>
  );
};

export default SensorCard;