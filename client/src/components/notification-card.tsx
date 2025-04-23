import { BellRing, Check, CircleAlert } from "lucide-react";

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
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "./ui/scroll-area";

type CardProps = React.ComponentProps<typeof Card>;

const NotificationCard = ({ className, ...props }: CardProps) => {
  const apiClient = useAxios();
  const navigate = useNavigate();
  const { notifications, notificationLength, clearNotifications } =
    useNotifications();

  const [notificationsAllowed, setNotificationsAllowed] = useState(false);

  // get notification preference from local store
  useEffect(() => {
    const notificationsAllowed = browserStore.get("notificationsAllowed");
    if (notificationsAllowed === "true") setNotificationsAllowed(true);
    else setNotificationsAllowed(false);
  }, []);

  async function handleCheckChanged(checked: boolean) {
    if (checked) {
      const success = await requestNotificationPermission(apiClient);
      if (success)
        toast({
          title: "Success",
          description: "Subscribed to push notifications",
        });
    }
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
          You have {notificationLength} unchecked notification
          {notificationLength !== 1 && "s"}.
        </CardDescription>
      </CardHeader>
      <CardContent className={`grid gap-4 ${!notifications.length && "pb-0"}`}>
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
          <ScrollArea className="max-h-80 overflow-y-auto overflow-x-hidden">
            <div className="pr-4">
              {notifications.map((notification, index) => (
                <div
                  key={index}
                  className="mb-4 grid grid-cols-[auto_1fr_auto] items-start gap-4 pb-4 last:mb-0 last:pb-0"
                >
                  {/* Icon */}
                  <CircleAlert className="h-4 w-4 translate-y-1 stroke-foreground" />

                  {/* Message Content */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {notification.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {notification.body.message}
                    </p>
                  </div>

                  {/* Action Button with Check Icon */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-foreground"
                    onClick={() => {
                      navigate(
                        `/problems?feedback_id=${notification.body.meta.problem_id}`,
                      );
                    }}
                  >
                    <Check className="h-6 w-6" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
      {!!notifications.length && (
        <CardFooter>
          <Button
            disabled={!notifications.length}
            className="w-full"
            onClick={handleMarkAllAsRead}
          >
            Clear All Notifications
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};

export default NotificationCard;
