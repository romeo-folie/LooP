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

const notifications = [
  {
    title: "Your call has been confirmed.",
    description: "1 hour ago",
  },
  {
    title: "You have a new message!",
    description: "1 hour ago",
  },
  {
    title: "Your subscription is expiring soon!",
    description: "2 hours ago",
  },
];

type CardProps = React.ComponentProps<typeof Card>;

const NotificationCard = ({ className, ...props }: CardProps) => {
  const apiClient = useAxios();
  const [notificationsAllowed, setNotificationsAllowed] = useState(false);
  // get notification preference from local store
  useEffect(() => {
    const notificationsAllowed = browserStore.get("notificationsAllowed");
    if (notificationsAllowed === "true") setNotificationsAllowed(true);
    else setNotificationsAllowed(false);
  }, []);

  function handleCheckChanged(checked: boolean) {
    if (checked) requestNotificationPermission(apiClient)
    browserStore.set("notificationsAllowed", checked.toString());
    setNotificationsAllowed(checked)
  }

  return (
    <Card className={cn("w-[380px]", className)} {...props}>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>You have 3 unread messages.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
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
            <Switch checked={notificationsAllowed} onCheckedChange={handleCheckChanged}/>
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
                  {notification.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">
          <Check /> Mark all as read
        </Button>
      </CardFooter>
    </Card>
  );
};

export default NotificationCard;
