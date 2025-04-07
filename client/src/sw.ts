import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import syncOutbox from "./lib/background-sync";

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();


interface NotificationData {
  title: string;
  body: { message: string; due_datetime: Date };
}

self.addEventListener("push", (event: PushEvent) => {
  if (event.data) {
    const data: NotificationData = event.data.json() || {};

    event.waitUntil(
      (async (): Promise<void> => {
        const iconUrl: string = "/logo.svg";

        // trigger OS alert
        await self.registration.showNotification(data.title, {
          body: data.body.message,
          icon: iconUrl,
        });

        // broadcast a message to open tabs (clients) to display in app alert
        const allClients: readonly WindowClient[] = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        allClients.forEach((client: WindowClient) => {
          client.postMessage({
            type: "IN_APP_ALERT",
            payload: data,
          });
        });
      })()
    );
  }
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: readonly WindowClient[]) => {

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

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data.type === "SYNC_OUTBOX") {
    event.waitUntil(syncOutbox());
  }
});
