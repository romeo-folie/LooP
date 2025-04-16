import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import browserStore from "@/lib/browser-storage";
import { toast } from "@/hooks/use-toast";

export type Notification = {
  title: string;
  body: { message: string; meta: { due_datetime: Date; problem_id: number } };
};

interface NotificationContextType {
  notifications: Notification[];
  notificationLength: number;
  removeNotification: (problemId: number) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationLength, setNotificationLength] = useState<number>(0);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (type === "IN_APP_ALERT") {
        browserStore.set("notifications", payload);
        setNotifications((prev) => [...prev, payload]);
        toast({
          title: payload.title,
          description: payload.body.message,
        });
      }
    };

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", listener);
    }

    return () =>
      navigator.serviceWorker.removeEventListener("message", listener);
  }, []);

  useEffect(() => {
    const localNotifications = browserStore.get("notifications");
    setNotifications(localNotifications.reverse());
  }, []);

  useEffect(() => {
    setNotificationLength(notifications.length);
  }, [notifications]);

  function removeNotification(problemId: number) {
    const currentNotifications = [...notifications];
    const notificationIndex = currentNotifications.findIndex(
      (notification) => notification.body.meta.problem_id === problemId,
    );
    currentNotifications.splice(notificationIndex, 1);
    setNotifications(currentNotifications);
    browserStore.set("notifications", currentNotifications);
  }

  function clearNotifications() {
    browserStore.set("notifications", []);
    setNotifications([]);
  }

  const value: NotificationContextType = {
    notifications,
    notificationLength,
    removeNotification,
    clearNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
