import "dotenv/config";

const requiredEnvVars = [
  "PORT",
  "NODE_ENV",
  "FRONTEND_URL",
  "JWT_SECRET",
  "MONGO_URI",
  "MQTT_URL",
  "MQTT_USER",
  "MQTT_PASS",
  "TG_TOKEN",
  "TG_CHAT_ID",
];

// Validasi tersentralisasi (Fail-Fast)
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ FATAL ERROR: Environment variable ${envVar} is missing!`);
    process.exit(1); // Stop program / panic
  }
}

// Export object ENV yang sudah pasti 100% bertipe string (bukan undefined)
export const ENV = {
  PORT: process.env.PORT as string,
  NODE_ENV: process.env.NODE_ENV as string,
  FRONTEND_URL: process.env.FRONTEND_URL as string,
  JWT_SECRET: process.env.JWT_SECRET as string,
  MONGO_URI: process.env.MONGO_URI as string,
  MQTT_URL: process.env.MQTT_URL as string,
  MQTT_USER: process.env.MQTT_USER as string,
  MQTT_PASS: process.env.MQTT_PASS as string,
  TG_TOKEN: process.env.TG_TOKEN as string,
  TG_CHAT_ID: process.env.TG_CHAT_ID as string,
};
