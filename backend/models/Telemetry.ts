import mongoose, { Document, Schema } from "mongoose";

export interface ITelemetry extends Document {
  device_id: string;
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
  device_id: { type: String, default: "UNKNOWN" },
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

// CREATE INDEX ON TIMESTAMP FOR O(log N) QUERIES AND SORTING!
telemetrySchema.index({ timestamp: -1 });

export default mongoose.model<ITelemetry>("Telemetry", telemetrySchema);
