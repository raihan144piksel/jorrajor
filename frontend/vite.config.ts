import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  build: {
    rolldownOptions: {
      output: {
        /**
         * Memisahkan library eksternal (node_modules) menjadi chunk file terpisah (code-splitting)
         * saat proses bundling produksi untuk mengoptimalkan pemuatan halaman di browser.
         * 
         * @param id - Path modul yang sedang diproses
         * @returns Nama chunk target atau undefined
         */
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-router-dom")) {
              return "vendor-react";
            }
            if (id.includes("recharts")) {
              return "vendor-charts";
            }
            if (
              id.includes("axios") ||
              id.includes("mqtt") ||
              id.includes("socket.io-client")
            ) {
              return "vendor-utils";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
