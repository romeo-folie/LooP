import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ReminderCardProps {
  date: Date;
  is_sent: boolean;
}

const ReminderCard: React.FC<ReminderCardProps> = ({
  date = new Date(),
  is_sent = false, // false for 'pending', true for 'sent'
}) => {
  // Format the date components
  const day = date.getDate();
  const month = date
    .toLocaleString("default", { month: "short" })
    .toLowerCase();

  // Format the time (hours and minutes)
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;

  // Set status color for vertical line
  const statusColor = is_sent ? "bg-green-500" : "bg-yellow-500";

  return (
    <Card className="w-64 overflow-hidden relative">
      {/* Ellipsis in top right corner */}
      <div className="absolute top-0 right-0 z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">
              <MoreHorizontal size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Reschedule</DropdownMenuItem>
            <DropdownMenuItem>
              Mark as {is_sent ? "pending" : "sent"}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="px-4 pt-10">
        <div className="flex items-center">
          {/* Vertical status line */}
          <div className={`${statusColor} w-2 h-16 rounded-sm mr-4`}></div>

          {/* Calendar box with date */}
          <div className="flex flex-col items-center justify-center h-16 w-16 border border-gray-200 bg-gray-50 dark:bg-gray-800">
            <span className="text-2xl font-bold">{day}</span>
            <span className="text-sm">{month}</span>
          </div>

          {/* Spacer */}
          <div className="flex-grow"></div>

          {/* Time display */}
          <div className="flex flex-col items-end">
            <span className="text-xs text-gray-500">Time</span>
            <span className="text-xl font-bold">{formattedTime}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ReminderCard;
