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
  body: { message: string; due_datetime: Date };
};

interface NotificationContextType {
  notifications: Notification[];
  notificationLength: number;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider"
    );
  }
  return context;
};

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationLength, setNotificationLength] = useState<number>(0);

  useEffect(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        const { type, payload } = event.data || {};
        if (type === "IN_APP_ALERT") {
          browserStore.set("notifications", payload);
          setNotifications((prev) => [...prev, payload]);
          setNotificationLength((prev) => prev + 1);
          toast({
            title: payload.title,
            description: payload.body.message,
          });
        }
      });
    }
  }, []);

  useEffect(() => {
    const localNotifications = browserStore.get("notifications");
    setNotifications(localNotifications.reverse());
    setNotificationLength(localNotifications.length);
  }, []);

  function clearNotifications() {
    browserStore.set("notifications", []);
    setNotifications([]);
    setNotificationLength(0);
  }

  const value: NotificationContextType = {
    notifications,
    notificationLength,
    clearNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
