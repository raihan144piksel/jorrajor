import React from 'react';

const ControlButton = ({ label, device, status, onControl, activeColor }) => {
  // Mapping warna tailwind secara dinamis
  const activeColors = {
    orange: 'bg-orange-500 text-white shadow-orange-500/20',
    blue: 'bg-blue-500 text-white shadow-blue-500/20',
    yellow: 'bg-yellow-500 text-white shadow-yellow-500/20',
  };
  const inactiveClass = 'bg-slate-700 text-slate-400';

  return (
    <button
      onClick={() => onControl(device, status)}
      className={`px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 hover:brightness-110 ${status ? activeColors[activeColor] : inactiveClass}`}
    >
      {label}: {status ? 'ON' : 'OFF'}
    </button>
  );
};

export default ControlButton;