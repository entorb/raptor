import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

const phasermsg = () => {
  return {
    name: "phasermsg",
    buildStart() {
      process.stdout.write(`Building for production...\n`)
    },
    buildEnd() {
      process.stdout.write(`✨ Done ✨\n`)
    },
  }
}

// Matomo visitor counting, prod build only (dev uses config.dev.mjs)
const matomo = () => ({
  name: "matomo",
  transformIndexHtml: {
    order: "post",
    handler(html, ctx) {
      if (ctx.filename && !ctx.filename.endsWith("index.html")) return html
      const script = `<script>
  var _paq = window._paq = window._paq || [];
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var u="https://entorb.net/stats/matomo/";
    _paq.push(['setTrackerUrl', u+'matomo.php']);
    _paq.push(['setSiteId', '19']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s);
  })();
</script>`
      return html.replace("</head>", `${script}</head>`)
    },
  },
})

export default defineConfig({
  root: "src",
  publicDir: "../public",
  base: "/raptor/",
  logLevel: "warning",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/phaser")) return "phaser"
        },
      },
    },
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 2,
      },
      mangle: true,
      format: {
        comments: false,
      },
    },
  },
  server: {
    port: 8080,
  },
  plugins: [
    phasermsg(),
    matomo(),
    VitePWA({
      registerType: "prompt",
      // Inject the registration script; avoids importing virtual:pwa-register.
      injectRegister: "auto",
      manifest: {
        name: "Raptor: Call of the Void",
        short_name: "Raptor",
        description:
          "Vertical space shooter. A modern remake of the 1994 MS-DOS classic Raptor: Call of the Shadows.",
        display: "standalone",
        orientation: "landscape",
        background_color: "#05060d",
        theme_color: "#05060d",
        categories: ["games"],
        id: "/raptor/",
        icons: [
          { src: "icons/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // The 512 px icons are only fetched by the browser on install; keep them out of the precache.
      includeManifestIcons: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ogg,json,webmanifest}"],
        // Music (~6 MB) is loaded on demand (Audio.playSong) and cached when first heard.
        globIgnores: ["assets/music/**", "icons/*512x512.png"],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/music\/[^/]+\.ogg$/,
            handler: "CacheFirst",
            options: {
              cacheName: "music",
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        navigateFallback: "index.html",
        cleanupOutdatedCaches: true,
      },
      // Dev keeps the plain server; test offline from the production build.
      devOptions: { enabled: false },
    }),
  ],
})
