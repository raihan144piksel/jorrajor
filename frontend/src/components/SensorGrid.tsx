import React from "react";
import { Thermometer, Droplets, Sun } from "lucide-react";
import SensorCard from "./SensorCard";
import { TelemetryData } from "../types";

interface SensorGridProps {
    data: TelemetryData;
}

const SensorGrid: React.FC<SensorGridProps> = ({ data }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <SensorCard
                title="Suhu Udara"
                value={data.suhu}
                unit="°C"
                icon={Thermometer}
                color="border-orange-500"
                state={data.state_kipas}
                iconColor="text-orange-500"
            />
            <SensorCard
                title="Kelembapan Udara"
                value={data.kelembapan_udara}
                unit="%"
                icon={Droplets}
                color="border-emerald-500"
                state={data.state_pompa}
                iconColor="text-emerald-500"
            />
            <SensorCard
                title="Kelembapan Tanah"
                value={data.tanah}
                unit="%"
                icon={Droplets}
                color="border-blue-500"
                state={data.state_pompa}
                iconColor="text-blue-500"
            />
            <SensorCard
                title="Intensitas Cahaya"
                value={data.cahaya}
                unit="%"
                icon={Sun}
                color="border-yellow-500"
                state={data.state_lampu}
                iconColor="text-yellow-500"
            />
        </div>
    );
};

export default SensorGrid;
