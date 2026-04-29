import { ENV } from "./config/env.js";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db.js";
import { initMqtt, isEspOnline, getMqttClient } from "./services/mqttService.js";

import authRoutes from "./routes/authRoutes.js";
import telemetryRoutes from "./routes/telemetryRoutes.js";
import settingsRoutes from "./routes/settingsRoutes.js";
import controlRoutes from "./routes/controlRoutes.js";

connectDB();

const app = express();
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
  socket.emit("esp_status", isEspOnline());
});

initMqtt(io);

app.use("/api", authRoutes);
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/control", controlRoutes);

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

httpServer.listen(ENV.PORT, () =>
  console.log(`🚀 Server + Socket.io running on port ${ENV.PORT}`)
);
