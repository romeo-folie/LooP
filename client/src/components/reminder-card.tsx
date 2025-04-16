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
import type { ReminderResponse } from "@/pages/problems/ProblemDashboard";

interface ReminderCardProps {
  reminder: ReminderResponse;
  onEdit: (reminder: ReminderResponse) => void;
  onDelete: (reminder: ReminderResponse) => void;
}

const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onEdit,
  onDelete,
}) => {
  // Format the date components
  // eslint-disable-next-line prefer-const
  let { due_datetime, is_sent } = reminder;
  due_datetime = new Date(due_datetime);
  const day = due_datetime.getDate();
  const month = due_datetime
    .toLocaleString("default", { month: "short" })
    .toLowerCase();

  // Format the time (hours and minutes)
  const hours = due_datetime.getHours();
  const minutes = due_datetime.getMinutes();
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
            <Button
              variant="ghost"
              className="hover:bg-transparent outline-none ring-0 focus-visible:ring-0 inset-ring-0 shadow-none inset-shadow-none"
            >
              <MoreHorizontal size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* //TODO: find a way to update reminder card after notification is sent */}
            {!is_sent && (
              <DropdownMenuItem onClick={() => onEdit(reminder)}>
                Reschedule
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-red-600"
              onClick={() => onDelete(reminder)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardContent className="px-4 pt-8">
        <div className="flex items-center">
          {/* Vertical status line */}
          <div className={`${statusColor} w-2 h-14 rounded-sm mr-3`}></div>

          {/* Calendar box with date */}
          <div className="flex flex-col items-center justify-center h-14 w-14 border rounded-md border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <span className="text-2xl font-black">{day}</span>
            <span className="text-xs">{month}</span>
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
