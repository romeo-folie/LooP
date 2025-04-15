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
import { BellIcon } from "@radix-ui/react-icons";

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
      <AlertDialogContent className="gap-y-4 w-[90vw] sm:max-w-md rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg lg:text-xl flex items-center justify-center sm:justify-start gap-2">
            <BellIcon className="h-6 w-6" />
            Enable Notifications?
          </AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription className="text-foreground text-base text-center sm:text-left dark:text-gray-300">
          We use notifications to remind you to revise the problems you solve.
          By enabling them, you'll never miss a scheduled reminder.
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
