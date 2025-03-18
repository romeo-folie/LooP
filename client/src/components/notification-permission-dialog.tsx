import React from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Bell } from "lucide-react";

interface NotificationPermissionDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
}

const NotificationPermissionDialog: React.FC<
  NotificationPermissionDialogProps
> = ({ isOpen, onOpenChange, onConfirm, onCancel }) => {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="gap-y-4">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Enable Notifications?
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription className="text-foreground text-base">
            We use notifications to remind you to revise the problems you solve.
            By enabling them, you'll never miss a scheduled reminder.            
          </AlertDialogDescription>
          <AlertDialogDescription className="text-sm text-gray-500">
            Without notifications, you might overlook functionality that is critical to
            your success in this app. It's entirely optional, but highly
            recommended!
          </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>No, thanks</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Yes, enable</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default NotificationPermissionDialog;
