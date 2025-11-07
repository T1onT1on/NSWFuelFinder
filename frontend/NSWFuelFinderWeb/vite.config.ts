import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // forward API calls to backend
      "/api": {
        target: "http://localhost:5098",
        changeOrigin: true,
        secure: false,
      },
      // forward health checks too (no /api prefix)
      "/healthz": {
        target: "http://localhost:5098",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});