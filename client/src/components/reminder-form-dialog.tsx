import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosInstance } from "axios";
import { Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";
import type { ReminderResponse } from "@/pages/problems/ProblemDashboard";
import { DateTimePicker } from "./date-time-picker";

const reminderSchema = z.object({
  due_datetime: z.date({ required_error: "Date is required" }),
});

type ReminderFormData = z.infer<typeof reminderSchema>;

async function createReminder(
  problemId: number,
  formData: ReminderFormData,
  apiClient: AxiosInstance
): Promise<ReminderResponse> {
  const payload = { due_datetime: formData.due_datetime };

  const { data } = await apiClient.post(`/reminders/${problemId}`, payload);
  return data;
}

async function updateReminder(
  problemId: number,
  formData: ReminderFormData,
  apiClient: AxiosInstance
): Promise<ReminderResponse> {
  const payload = { due_datetime: formData.due_datetime };

  const { data } = await apiClient.put(`/reminders/${problemId}`, payload);
  return data;
}

interface ReminderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "new" | "edit";
  problemId: number;
  reminder?: ReminderResponse;
}

const ReminderFormDialog = ({
  isOpen,
  onOpenChange,
  mode,
  problemId,
  reminder,
}: ReminderDialogProps) => {
  const apiClient = useAxios();
  const queryClient = useQueryClient();

  const defaultVals: Partial<ReminderFormData> = useMemo(
    () =>
      mode === "edit" && reminder
        ? {
            due_datetime: reminder.due_datetime,
          }
        : {
            date: undefined,
          },
    [mode, reminder]
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: defaultVals,
  });

  const mutation = useMutation<
    ReminderResponse,
    AxiosError<APIErrorResponse>,
    ReminderFormData
  >({
    mutationFn: (formData) => {
      if (mode === "edit") {
        return updateReminder(problemId, formData, apiClient);
      } else {
        return createReminder(problemId, formData, apiClient);
      }
    },
    onSuccess: ({ message }) => {
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      toast({
        title: "Success",
        description: message,
      });
      onOpenChange(false);
      reset();
    },
    onError: (error) => {
      console.error(error);
      toast({
        title: "Error",
        description:
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to save reminder",
        variant: "destructive",
      });
      onOpenChange(false);
      reset();
    },
  });

  const onSubmit = (data: ReminderFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {mode === "edit" ? "Edit Reminder" : "New Reminder"}
          </DialogTitle>
          <DialogDescription>
            Please select a date and time for the reminder.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
          {/* Due DateTime Field */}
          <div>
            <Controller
              name="due_datetime"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  {...field}
                  value={reminder?.due_datetime}
                  placeholder="Set Due Date & Time"
                />
              )}
            />
            {errors.due_datetime && (
              <p className="text-red-500 text-sm mt-1">
                {errors.due_datetime.message}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin mr-2" />
            ) : mode === "edit" ? (
              "Save"
            ) : (
              "Add Reminder"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ReminderFormDialog;