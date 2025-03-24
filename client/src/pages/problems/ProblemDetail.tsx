import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import ReminderCard from "@/components/reminder-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { ProblemResponse } from "./ProblemDashboard";
import ProblemFormDialog from "@/components/problem-form-dialog";
import { ReminderFormDialog } from "@/components/reminder-form-dialog";
import type { ReminderResponse } from "@/pages/problems/ProblemDashboard";

// Example color coding for difficulty
const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500 text-white",
  Medium: "bg-yellow-500 text-white",
  Hard: "bg-red-500 text-white",
};

interface ProblemDetailProps {
  problem: ProblemResponse;
}

const ProblemDetail: React.FC<ProblemDetailProps> = ({ problem }) => {
  const [isProblemDialogOpen, setIsProblemDialogOpen] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderResponse | undefined>(undefined);

  // Callback passed to ReminderCard that triggers editing.
  const handleEditReminder = (reminder: ReminderResponse) => {
    setEditingReminder(reminder);
    setIsReminderDialogOpen(true);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header: Title & Edit Button */}
      <div className="flex justify-between items-start">
        {/* Title & Notes */}
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{problem.name}</h1>
          <p className="text-gray-700 mt-5">{problem.notes}</p>
        </div>

        {/* Edit + Difficulty & Tags */}
        <div className="flex flex-col items-end gap-4">
          {/* Edit Button */}
          <Button
            className="flex items-center gap-2"
            onClick={() => setIsProblemDialogOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>

          {/* Difficulty & Tags */}
          <div className="text-right space-y-2">
            <div className="space-y-2">
              <p className="text-gray-500 text-sm font-bold">Difficulty</p>
              <Badge className={`${difficultyColors[problem.difficulty]}`}>
                {problem.difficulty}
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-gray-500 text-sm font-bold">Tags</p>
              <div className="flex flex-wrap gap-2 justify-end">
                {problem.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reminders Section */}
      {problem.reminders && problem.reminders.length > 0 && (
        <div className="mt-4">
          <h2 className="text-xl font-semibold mb-2">Reminders</h2>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pt-5 pb-3">
              {problem.reminders.map((rem, index) => (
                <ReminderCard key={index} reminder={rem} 
                onEdit={handleEditReminder} 
                />
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* Problem Form Dialog */}
      <ProblemFormDialog
        mode="edit"
        problem={problem}
        isOpen={isProblemDialogOpen}
        onOpenChange={setIsProblemDialogOpen}
      />

      {/* Reminder Form Dialog */}
      <ReminderFormDialog
        isOpen={isReminderDialogOpen}
        onOpenChange={setIsReminderDialogOpen}
        mode="edit"
        problemId={problem.problem_id}
        reminder={editingReminder}
      />
    </div>
  );
};
export default ProblemDetail;
