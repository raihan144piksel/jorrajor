import React from 'react';
import { Power } from 'lucide-react';
import ControlButton from './ControlButton';

const ControlPanel = ({ data, onControl }) => {
  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
      <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-200">
        <Power size={20} className="text-red-400" /> Manual Override
      </h2>
      <div className="flex flex-wrap gap-4">
        <ControlButton 
          label="KIPAS"
          device="kipas"
          status={data.status_kipas}
          activeColor="orange"
          onControl={onControl}
        />
        <ControlButton 
          label="POMPA"
          device="pompa"
          status={data.status_pompa}
          activeColor="blue"
          onControl={onControl}
        />
        <ControlButton 
          label="LAMPU"
          device="lampu"
          status={data.status_lampu}
          activeColor="yellow"
          onControl={onControl}
        />
      </div>
      <p className="mt-4 text-xs text-slate-500 italic">
        *Klik tombol untuk mengubah status relay secara manual (Override).
      </p>
    </div>
  );
};

export default ControlPanel;