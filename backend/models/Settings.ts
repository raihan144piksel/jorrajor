import mongoose, { Document, Schema } from "mongoose";

export interface ISettings extends Document {
  temp_threshold: number;
  hum_threshold: number;
  light_threshold: number;
  retention_days: number;
  updated_at: Date;
}

const settingsSchema: Schema = new mongoose.Schema({
  temp_threshold: { type: Number, default: 30 },
  hum_threshold: { type: Number, default: 40 },
  light_threshold: { type: Number, default: 20 },
  retention_days: { type: Number, default: 30 },
  updated_at: { type: Date, default: Date.now },
});

export default mongoose.model<ISettings>("Settings", settingsSchema);
