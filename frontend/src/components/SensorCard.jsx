import React from 'react';


const statusStyles = {
  ON: { color: 'bg-green-500', text: 'text-green-400' },
  TRIGGERED: { color: 'bg-amber-500', text: 'text-amber-400' },
  IDLE: { color: 'bg-slate-500', text: 'text-slate-300' },
  COOLDOWN: { color: 'bg-red-500', text: 'text-red-400' },
};



const SensorCard = ({ title, value, unit, icon: Icon, color, state, iconColor }) => {
  
  const safeState = (state || 'IDLE').toUpperCase();
  const currentStyle = statusStyles[safeState] || statusStyles.IDLE;

  return (
    <div className={`p-6 rounded-2xl bg-slate-800 border-l-4 ${color} shadow-lg transition-all hover:scale-105`}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-bold mt-1 text-white">
            {value} <span className="text-lg font-normal text-slate-500">{unit}</span>
          </h3>
        </div>
        <div className={`p-3 rounded-lg bg-slate-700 ${iconColor}`}>
          <Icon size={24} />
        </div>
      </div>
      
      {/* Indikator State (IDLE, TRIGGERED, ON, COOLDOWN) */}
      <div className="mt-4 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full animate-pulse ${currentStyle.color}`}></span>
        <p className="text-xs font-semibold text-slate-400 italic">
          STATUS: <span className={currentStyle.text}>{state || 'IDLE'}</span>
        </p>
      </div>
    </div>
  );
};

export default SensorCard;