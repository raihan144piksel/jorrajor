import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/**
 * Titik masuk (entrypoint) utama aplikasi React yang merender elemen root
 * ke DOM dengan StrictMode aktif untuk mendeteksi potensi masalah.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
