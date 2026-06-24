import mongoose, { Document, Schema } from "mongoose";

export interface ILoginLog extends Document {
  username: string;
  ip_address: string;
  status: "SUCCESS" | "FAILED";
  timestamp: Date;
}

const loginLogSchema: Schema = new mongoose.Schema({
  username: { type: String, required: true },
  ip_address: { type: String, required: true },
  status: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

// Index timestamp for fast querying
loginLogSchema.index({ timestamp: -1 });

export default mongoose.model<ILoginLog>("LoginLog", loginLogSchema);
