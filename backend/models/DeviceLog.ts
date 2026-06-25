import mongoose, { Document, Schema } from "mongoose";

export interface IDeviceLog extends Document {
  device_id: string;
  event: "ONLINE" | "OFFLINE";
  timestamp: Date;
}

const deviceLogSchema: Schema = new mongoose.Schema({
  device_id: { type: String, required: true, default: "device0" },
  event: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Index timestamp for fast sorting
deviceLogSchema.index({ timestamp: -1 });

export default mongoose.model<IDeviceLog>("DeviceLog", deviceLogSchema);
