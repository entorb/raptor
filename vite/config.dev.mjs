import { defineConfig } from "vite"

export default defineConfig({
  root: "src",
  publicDir: "../public",
  base: "/raptor/",
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) return "phaser"
        },
      },
    },
  },
  server: {
    host: true,
    port: 5173,
  },
})
