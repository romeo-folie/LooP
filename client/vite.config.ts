import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'


export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      devOptions: {
        enabled: true,
        type: 'module',
      },
      manifest: {
        name: "DSA Reminder App",
        short_name: "DSA Reminders",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        start_url: ".",
        // icons: [
        //   {
        //     src: "icon-192.png",
        //     sizes: "192x192",
        //     type: "image/png"
        //   },
        //   {
        //     src: "icon-512.png",
        //     sizes: "512x512",
        //     type: "image/png"
        //   }
        // ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
