// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).__WB_DISABLE_DEV_LOGS = true;

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import syncOutbox from "./lib/background-sync";
import { addLocalNotification } from "./lib/db";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

interface NotificationData {
  title: string;
  body: { message: string; meta: { due_datetime: number; problem_id: number } };
}

self.addEventListener("push", (event: PushEvent) => {
  if (event.data) {
    let data: NotificationData = {} as NotificationData;

    try {
      data = event.data.json();
    } catch (error) {
      console.log("failed to parse notification", error);
      return;
    }

    event.waitUntil(
      (async (): Promise<void> => {
        const iconUrl: string = "/logo.svg";

        // trigger OS alert
        await self.registration.showNotification(data.title, {
          body: data.body.message,
          data: data.body.meta,
          icon: iconUrl,
        });

        // save notification locally
        addLocalNotification(data);

        // broadcast a message to open tabs (clients) to display in app alert
        const allClients: readonly WindowClient[] = await self.clients.matchAll(
          {
            type: "window",
            includeUncontrolled: true,
          },
        );

        if (allClients.length) {
          allClients.forEach((client: WindowClient) => {
            client.postMessage({
              type: "IN_APP_ALERT",
              payload: data,
            });
          });
        }
      })(),
    );
  }
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  const { problem_id } = event.notification.data || {};
  event.notification.close();

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList: readonly WindowClient[]) => {
        // If an existing window is open, focus it
        if (clientList.length) {
          for (const client of clientList) {
            if (client.url.includes("/problems") && "focus" in client) {
              client.navigate(`/problems?feedback_id=${problem_id}`);
              return client.focus();
            }
          }
        } else if (self.clients.openWindow) {
          // Otherwise, open a new tab
          return self.clients.openWindow(`/problems?feedback_id=${problem_id}`);
        }
      }),
  );
});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data.type === "SYNC_OUTBOX") {
    event.waitUntil(syncOutbox());
  }
});
