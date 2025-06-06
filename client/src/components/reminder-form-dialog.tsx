import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError, AxiosInstance } from "axios";
import { Loader2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/hooks/use-toast";
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";
import type {
  ReminderResponse,
  ReminderResponseData,
} from "@/pages/problems/ProblemDashboard";
import DateTimePicker from "./date-time-picker";
import {
  Credenza,
  CredenzaContent,
  CredenzaDescription,
  CredenzaHeader,
  CredenzaTitle,
} from "@/components/credenza";
import { logger } from "@/lib/logger";
import {
  addLocalReminder,
  ReminderSchema,
  updateLocalReminder,
} from "@/lib/db";
import { useNetworkStatus } from "@/context/network-status-provider";

const reminderSchema = z.object({
  due_datetime: z
    .date({ required_error: "Date is required" })
    .refine((date) => date.getTime() > Date.now(), {
      message: "Date must be in the future",
    }),
});

type ReminderFormData = z.infer<typeof reminderSchema>;

async function createReminder(
  problemId: number | string,
  formData: ReminderFormData,
  apiClient: AxiosInstance,
  isOnline: boolean,
): Promise<ReminderResponseData> {
  const payload = { due_datetime: formData.due_datetime };
  try {
    if (!isOnline) {
      const localReminder = {
        ...payload,
        is_sent: false,
        isOffline: 1,
        local_id: `offline-${Date.now()}`,
      } as ReminderSchema;
      await addLocalReminder(problemId, localReminder);
      return {
        message: "Reminder created offline",
        reminder: localReminder,
      };
    }

    const { data } = await apiClient.post(`/reminders/${problemId}`, payload);
    return data;
  } catch (error) {
    logger.error(`error requesting reminder creation ${error}`);
    throw error;
  }
}

async function updateReminder(
  reminderId: number | string,
  problemId: number | string,
  formData: ReminderFormData,
  apiClient: AxiosInstance,
  isOnline: boolean,
): Promise<ReminderResponseData> {
  const payload = { due_datetime: formData.due_datetime };
  try {
    if (!isOnline) {
      await updateLocalReminder(reminderId, problemId, payload);
      return {
        message: "Reminder updated offline",
        reminder: {} as ReminderSchema,
      };
    }
    const { data } = await apiClient.put(`/reminders/${reminderId}`, payload);
    return data;
  } catch (error) {
    logger.error(`error requesting reminder update ${error}`);
    throw error;
  }
}

interface ReminderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "new" | "edit";
  problemId: number | string;
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
  const { isOnline } = useNetworkStatus();

  const defaultVals: Partial<ReminderFormData> = useMemo(
    () =>
      mode === "edit" && reminder
        ? {
            due_datetime: reminder.due_datetime,
          }
        : {
            date: undefined,
          },
    [mode, reminder],
  );

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ReminderFormData>({
    resolver: zodResolver(reminderSchema),
    defaultValues: defaultVals,
    mode: "onChange",
  });

  const mutation = useMutation<
    ReminderResponseData,
    AxiosError<APIErrorResponse>,
    ReminderFormData
  >({
    mutationFn: (formData) => {
      if (mode === "edit") {
        return updateReminder(
          (reminder?.reminder_id as number) || (reminder?.local_id as string),
          problemId,
          formData,
          apiClient,
          isOnline,
        );
      } else {
        return createReminder(problemId, formData, apiClient, isOnline);
      }
    },
    onSuccess: ({ message }) => {
      reset();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["problems"] });
      toast({
        title: "Success",
        description: message,
      });
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
    <Credenza open={isOpen} onOpenChange={onOpenChange}>
      <CredenzaContent className="px-6 pb-8">
        <CredenzaHeader className="text-left mb-4 pl-0">
          <CredenzaTitle className="text-xl lg:text-2xl font-bold">
            {mode === "edit" ? "Edit Reminder" : "New Reminder"}
          </CredenzaTitle>
          <CredenzaDescription>
            Please select a date and time for the reminder.
          </CredenzaDescription>
        </CredenzaHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Due DateTime Field */}
          <div>
            <Controller
              name="due_datetime"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  {...field}
                  value={
                    reminder ? new Date(reminder?.due_datetime) : undefined
                  }
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
      </CredenzaContent>
    </Credenza>
  );
};

export default ReminderFormDialog;
