import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // base defaults to "/" (local dev); the combined deploy builds with
  // `vite build --base=/tagger/` so the tagger lives under /tagger.
  plugins: [react()],
  server: { port: 5180, open: true },
});
