import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import ReminderCard from "@/components/reminder-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { ProblemResponse } from "./ProblemDashboard";
import ProblemFormDialog from "@/components/problem-form-dialog";
import ReminderFormDialog from "@/components/reminder-form-dialog";
import type { ReminderResponse } from "@/pages/problems/ProblemDashboard";
import DeleteConfirmationDialog from "@/components/delete-confirmation-dialog";
import {
  APIErrorResponse,
  APISuccessResponse,
  useAxios,
} from "@/hooks/use-axios";
import { AxiosError, AxiosInstance } from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useMediaQuery } from "@/hooks/use-media-query";

// Example color coding for difficulty
const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500 text-white",
  Medium: "bg-yellow-500 text-white",
  Hard: "bg-red-500 text-white",
};

const deleteReminder = async function (
  reminder_id: number,
  apiClient: AxiosInstance
): Promise<APISuccessResponse> {
  const { data } = await apiClient.delete(`/reminders/${reminder_id}`);
  return data;
};

interface ProblemDetailProps {
  problem: ProblemResponse;
  tags: string[];
}

const ProblemDetail: React.FC<ProblemDetailProps> = ({ problem, tags }) => {
  const queryClient = useQueryClient();
  const apiClient = useAxios();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const [isProblemDialogOpen, setIsProblemDialogOpen] = useState(false);
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<
    ReminderResponse | undefined
  >(undefined);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Callback passed to ReminderCard that triggers editing.
  const handleEditReminder = (reminder: ReminderResponse) => {
    setEditingReminder(reminder);
    setIsReminderDialogOpen(true);
  };

  const onDeleteReminder = (reminder: ReminderResponse) => {
    setEditingReminder(reminder);
    setIsDeleteDialogOpen(true);
  };

  const mutation = useMutation<
    APISuccessResponse,
    AxiosError<APIErrorResponse>,
    number
  >({
    mutationFn: (reminder_id: number) => deleteReminder(reminder_id, apiClient),
    onSuccess: ({ message }) => {
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      toast({ title: "Success", description: message });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description:
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to delete reminder",
        variant: "destructive",
      });
    },
  });

  const handleConfirmReminderDelete = () => {
    mutation.mutate(editingReminder!.reminder_id);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header: Title & Edit Button */}
      <div className="flex justify-between items-start">
        {/* Title & Notes */}
        <div className="flex-auto">
          <h1 className="text-xl lg:text-2xl font-bold">{problem.name}</h1>
          <p className="text-gray-700 mt-5">{problem.notes}</p>
        </div>

        {/* Edit + Difficulty & Tags */}
        <div className="flex flex-col items-end gap-4 flex-auto">
          {/* Edit Button */}
          {isDesktop && (
            <Button
              className="flex items-center gap-2"
              onClick={() => setIsProblemDialogOpen(true)}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}

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
                  <Badge key={tag} className="text-nowrap">{tag}</Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reminders Section */}
      {problem.reminders && problem.reminders.length > 0 && (
        <div className="mt-4">
          <h2 className="text-lg lg:text-xl font-semibold mb-2">Reminders</h2>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-4 pt-5 pb-3">
              {problem.reminders.map((rem, index) => (
                <ReminderCard
                  key={index}
                  reminder={rem}
                  onEdit={handleEditReminder}
                  onDelete={onDeleteReminder}
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
        initialTagList={tags}
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

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmationDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirmDelete={handleConfirmReminderDelete}
        resource="reminder"
      />
    </div>
  );
};
export default ProblemDetail;
