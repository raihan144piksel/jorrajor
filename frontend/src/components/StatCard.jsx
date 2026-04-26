const StatCard = ({ label, value, subValue, color }) => {

    const displayValue = (value !== undefined && value !== null) ? value : '--';

    return (
        <div className={`bg-slate-800 p-4 rounded-xl border-l-4 ${color} shadow-lg`}>
            <p className="text-slate-500 text-[10px] font-bold uppercase">{label}</p>
            <h3 className="text-2xl font-bold text-white mt-1">{displayValue}</h3>
            {subValue && <p className="text-[10px] text-slate-400 mt-1">{subValue}</p>}
        </div>
    );
};

export default StatCard;