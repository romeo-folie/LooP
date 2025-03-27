import { AxiosError, AxiosInstance } from "axios";
import { logger } from "./logger";
import browserStore from "./browser-storage";

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export async function requestNotificationPermission(apiClient: AxiosInstance) {
  if (!("Notification" in window)) {
    console.error("This browser does not support notifications.");
    return;
  }

  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    logger.info("Notification permission granted");
    await subscribeToPush(apiClient)
  } else {
    browserStore.set("notificationsAllowed", "false");
    logger.warn("Notification permission not granted or denied explicitly.");
  }
}

export async function subscribeToPush(apiClient: AxiosInstance) {
  const registration = await navigator.serviceWorker.ready;

  // Attempt subscription
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true, // Must be true
    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
  });

  const authKey = subscription.getKey("auth");
  const p256dhKey = subscription.getKey("p256dh");

  const auth = arrayBufferToBase64(authKey!);
  const p256dh = arrayBufferToBase64(p256dhKey!);

  const subscriptionPayload = {
    endpoint: subscription.endpoint,
    auth,
    public_key: p256dh
  };

  try {
    await apiClient.post(`/subscriptions`, subscriptionPayload)
  } catch (error: unknown) {
    browserStore.set("notificationsAllowed", "false");
    const message = error instanceof AxiosError ? error.response?.data?.error || error.response?.data?.message :  "Error saving subscription"
    logger.error(message);
  }

}

// Helper to convert VAPID public key from base64 => Uint8Array
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const binaryData = window.atob(base64);
  const outputArray = new Uint8Array(binaryData.length);

  for (let i = 0; i < binaryData.length; ++i) {
    outputArray[i] = binaryData.charCodeAt(i);
  }
  return outputArray;
}

// Helper to convert ArrayBuffers to base64 
function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
