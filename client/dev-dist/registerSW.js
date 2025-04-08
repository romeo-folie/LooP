if ("serviceWorker" in navigator)
  navigator.serviceWorker
    .register("/dev-sw.js?dev-sw", { scope: "/", type: "module" })
    .then((registration) => console.log("SW registered:", registration))
    .catch((err) => console.error("SW registration failed:", err));
