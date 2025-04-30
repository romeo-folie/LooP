import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "@/hooks/use-toast";
import {
  clearLocalNotifications,
  deleteLocalNotification,
  fetchLocalNotifications,
} from "@/lib/db";

export type Notification = {
  title: string;
  body: { message: string; meta: { due_datetime: number; problem_id: number } };
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
    const listener = async (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (type === "IN_APP_ALERT") {
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
    async function retrieveLocalNotifications() {
      const localNotifications = await fetchLocalNotifications();
      setNotifications(localNotifications ?? []);
    }

    retrieveLocalNotifications();
  }, []);

  useEffect(() => {
    setNotificationLength(notifications.length);
  }, [notifications]);

  async function removeNotification(problemId: number) {
    const currentNotifications = [...notifications];
    const notificationIndex = currentNotifications.findIndex(
      (notification) => notification.body.meta.problem_id === problemId,
    );
    currentNotifications.splice(notificationIndex, 1);
    setNotifications(currentNotifications);
    await deleteLocalNotification(problemId);
  }

  async function clearNotifications() {
    await clearLocalNotifications();
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
