import { ENV } from "./config/env.js";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import {
  initMqtt,
  getOnlineDevices,
  getMqttClient,
} from "./services/mqttService.js";
import { startCleanupJob } from "./services/cleanupService.js";

import authRoutes from "./routes/authRoutes.js";
import telemetryRoutes from "./routes/telemetryRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import controlRoutes from "./routes/controlRoutes.js";
import otaRoutes from "./routes/otaRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";

connectDB();

const app = express();
app.set("trust proxy", 1);
const corsOrigin = ENV.NODE_ENV === "production" ? ENV.FRONTEND_URL : "*";

app.use(
  cors({
    origin: corsOrigin,
    methods: ["GET", "POST"],
  }),
);
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.emit("esp_statuses", getOnlineDevices());
});

initMqtt(io);

app.use("/api", authRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/control", controlRoutes);
app.use("/api/ota", otaRoutes);
app.use("/api/ai", aiRoutes);

const gracefulShutdown = () => {
  console.log("Shutting down gracefully...");
  const mqttClient = getMqttClient();
  if (mqttClient) {
    mqttClient.end();
  }
  httpServer.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

startCleanupJob();

httpServer.listen(ENV.PORT, () =>
  console.log(`🚀 Server + Socket.io running on port ${ENV.PORT}`),
);
