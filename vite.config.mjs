import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { clazzioFeedResponse } from './worker/clazzio-feed.mjs';
// The same read-only official feed is used in local and shared previews.

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "127.0.0.1",
    port: 4185,
    strictPort: true,
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(), { name: 'official-news-preview', configureServer(server) {
    server.middlewares.use('/api/clazzio-news', async (req, res) => {
      const response = await clazzioFeedResponse(new Request('http://127.0.0.1:4185/api/clazzio-news', { method: req.method }));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    });
  } }],
});
