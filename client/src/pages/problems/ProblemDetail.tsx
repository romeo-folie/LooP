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
import { logger } from "@/lib/logger";
import { useNetworkStatus } from "@/context/network-status-provider";
import { deleteLocalReminder } from "@/lib/db";
import { startCase } from "lodash";

// Example color coding for difficulty
const difficultyColors: Record<string, string> = {
  Easy: "bg-green-500 text-white",
  Medium: "bg-yellow-500 text-white",
  Hard: "bg-red-500 text-white",
};

const deleteReminder = async function (
  reminderId: number | string,
  problemId: number | string,
  apiClient: AxiosInstance,
  isOnline: boolean,
): Promise<APISuccessResponse> {
  try {
    if (!isOnline) {
      await deleteLocalReminder(reminderId, problemId);
      return {
        message: "Reminder deleted offline",
      };
    }
    const { data } = await apiClient.delete(`/reminders/${reminderId}`);
    return data;
  } catch (error) {
    logger.error(`error requesting reminder deletion ${error}`);
    throw error;
  }
};

interface ProblemDetailProps {
  problem: ProblemResponse;
  tags: string[];
}

const ProblemDetail: React.FC<ProblemDetailProps> = ({ problem, tags }) => {
  const queryClient = useQueryClient();
  const apiClient = useAxios();
  const { isOnline } = useNetworkStatus();

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
    number | string
  >({
    mutationFn: (reminderId: number | string) =>
      deleteReminder(
        reminderId,
        problem.problem_id ?? problem.local_id,
        apiClient,
        isOnline,
      ),
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
    mutation.mutate(
      (editingReminder!.reminder_id as number) ||
        (editingReminder!.local_id as string),
    );
  };

  return (
    <div className="p-4 space-y-6 pb-8">
      {/* Header: Title & Edit Button */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        {/* Left Column - Title and Notes */}
        <div className="flex-auto">
          <h1 className="text-xl lg:text-2xl font-bold">
            {startCase(problem.name)}
          </h1>

          {/* Tags + Difficulty (visible on mobile only) */}
          <div className="flex gap-4 mt-3 justify-between sm:hidden">
            <div>
              <p className="text-gray-500 text-sm font-bold mb-1">Difficulty</p>
              <Badge
                className={`${difficultyColors[problem.difficulty]} text-xs`}
              >
                {problem.difficulty}
              </Badge>
            </div>
            <div className="flex flex-col items-end ml-4">
              <p className="text-gray-500 text-sm font-bold mb-1">Tags</p>
              <div className="flex flex-wrap gap-2 justify-end">
                {problem.tags
                  .sort((a, b) => a.length - b.length)
                  .map((tag) => (
                    <Badge key={tag} className="text-nowrap text-xs">
                      {startCase(tag)}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <p className="mt-5 dark:text-gray-300 whitespace-pre-wrap max-h-72 overflow-auto pr-2">
            {problem.notes}
          </p>
        </div>

        {/* Right Column - Edit, Difficulty & Tags (desktop only) */}
        <div className="flex-col items-end gap-4 flex-shrink-0 sm:flex-auto sm:ml-2 hidden sm:flex">
          <Button
            className="flex items-center gap-2"
            onClick={() => setIsProblemDialogOpen(true)}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
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
                {problem.tags
                  .sort((a, b) => a.length - b.length)
                  .map((tag) => (
                    <Badge
                      key={tag}
                      className="text-nowrap"
                      style={{
                        display: "block",
                      }}
                    >
                      {startCase(tag)}
                    </Badge>
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
        problemId={
          (problem.problem_id as number) || (problem.local_id as string)
        }
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
