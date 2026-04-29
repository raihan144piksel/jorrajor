import mongoose, { Document, Schema } from "mongoose";

export interface ITelemetry extends Document {
  suhu: number;
  kelembapan_udara: number;
  tanah: number;
  cahaya: number;
  status_kipas: boolean;
  status_pompa: boolean;
  status_lampu: boolean;
  state_kipas: string;
  state_pompa: string;
  state_lampu: string;
  timestamp: Date;
}

const telemetrySchema: Schema = new mongoose.Schema({
  suhu: Number,
  kelembapan_udara: Number,
  tanah: Number,
  cahaya: Number,
  status_kipas: Boolean,
  status_pompa: Boolean,
  status_lampu: Boolean,
  state_kipas: String,
  state_pompa: String,
  state_lampu: String,
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.model<ITelemetry>("Telemetry", telemetrySchema);
