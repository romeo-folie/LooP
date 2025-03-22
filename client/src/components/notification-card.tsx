import { BellRing, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import browserStore from "@/lib/browser-storage";
import { useEffect, useState } from "react";
import { requestNotificationPermission } from "@/lib/push-notifications";
import { useAxios } from "@/hooks/use-axios";
import { useNotifications } from "@/context/notification-provider";

type CardProps = React.ComponentProps<typeof Card>;

const NotificationCard = ({ className, ...props }: CardProps) => {
  const apiClient = useAxios();
  const { notifications, clearNotifications } = useNotifications();

  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
 
  // get notification preference from local store
  useEffect(() => {
    const notificationsAllowed = browserStore.get("notificationsAllowed");
    if (notificationsAllowed === "true") setNotificationsAllowed(true);
    else setNotificationsAllowed(false);
  }, []);

  function handleCheckChanged(checked: boolean) {
    if (checked) requestNotificationPermission(apiClient);
    browserStore.set("notificationsAllowed", checked.toString());
    setNotificationsAllowed(checked);
  }

  function handleMarkAllAsRead() {
    clearNotifications();
  }

  return (
    <Card className={cn("w-[380px]", className)} {...props}>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>
          You have {notifications.length} unread messages.
        </CardDescription>
      </CardHeader>
      <CardContent
        className={`grid gap-4 ${!notifications.length ? "pb-0" : ""}`}
      >
        {!notificationsAllowed && (
          <div className="flex items-center space-x-4 rounded-md border p-4">
            <BellRing />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium leading-none">
                Push Notifications
              </p>
              <p className="text-sm text-muted-foreground">
                Send notifications to device.
              </p>
            </div>
            <Switch
              disabled={notificationsAllowed}
              checked={notificationsAllowed}
              onCheckedChange={handleCheckChanged}
            />
          </div>
        )}
        <div>
          {notifications.map((notification, index) => (
            <div
              key={index}
              className="mb-4 grid grid-cols-[25px_1fr] items-start pb-4 last:mb-0 last:pb-0"
            >
              <span className="flex h-2 w-2 translate-y-1 rounded-full bg-sky-500" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {notification.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {notification.body.message}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      {!!notifications.length && (
        <CardFooter>
          <Button
            disabled={!notifications.length}
            className="w-full"
            onClick={handleMarkAllAsRead}
          >
            <Check /> Mark all as read
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default NotificationCard;
