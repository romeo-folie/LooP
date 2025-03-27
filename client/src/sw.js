import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

cleanupOutdatedCaches()

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener("push", (event) => {
  if (event.data) {
    const data = event.data.json() || {};

    event.waitUntil(
      (async () => {
        const userAgent = navigator.userAgent.toLowerCase();

        const iconUrl = "/logo.svg";

        // if (userAgent.includes('android')) {
        //   iconUrl = "/logo.svg"; // Icon for Android devices
        // } else if (userAgent.includes('iphone') || userAgent.includes('ipad')) {
        //   iconUrl = "/apple-touch-icon-180x180.png"; // Icon for iOS devices
        // } else if (userAgent.includes('windows')) {
        //   iconUrl = "/logo.svg"; // SVG icon for Windows devices
        // }

        // trigger OS alert
        await self.registration.showNotification(data.title, {
          body: data.body.message,
          icon: iconUrl,
        });

        // broadcast a message to open tabs (clients) to display in app alert
        const allClients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        allClients.forEach((client) => {
          client.postMessage({
            type: "IN_APP_ALERT",
            payload: data,
          });
        });
      })()
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // For example, open a URL
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // If an existing window is open, focus it
        for (const client of clientList) {
          if (client.url.includes("/problems") && "focus" in client) {
            return client.focus();
          }
        }
        // Otherwise, open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow("/problems");
        }
      })
  );
});
