import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Tauri expects a fixed port and no auto-open of the browser.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    // O Vite não deve assistir o target do Cargo (o watcher do Node derruba
    // o dev server com EBUSY quando o cargo escreve os artefatos).
    watch: {
      ignored: ["**/src-tauri/target/**", "**/src-tauri/gen/**", "**/dist/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2021",
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
