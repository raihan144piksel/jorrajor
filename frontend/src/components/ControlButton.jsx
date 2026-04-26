import React from 'react';

const ControlButton = ({ label, device, status, onControl, activeColor }) => {
  // Mapping warna tailwind secara dinamis
  const colors = {
    orange: status ? 'bg-orange-500 text-white shadow-orange-500/20' : 'bg-slate-700 text-slate-400',
    blue: status ? 'bg-blue-500 text-white shadow-blue-500/20' : 'bg-slate-700 text-slate-400',
    yellow: status ? 'bg-yellow-500 text-white shadow-yellow-500/20' : 'bg-slate-700 text-slate-400',
  };

  return (
    <button
      onClick={() => onControl(device, status)}
      className={`px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 hover:brightness-110 ${colors[activeColor]}`}
    >
      {label}: {status ? 'ON' : 'OFF'}
    </button>
  );
};

export default ControlButton;