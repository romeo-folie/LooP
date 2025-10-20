import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/context/auth-provider";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/context/notification-provider";
import { toast } from "@/hooks/use-toast";
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";
import browserStore from "@/lib/browser-storage";
import { requestNotificationPermission } from "@/lib/push-notifications";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError, AxiosInstance } from "axios";
import { logger } from "@/lib/logger";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "@/context/theme-provider";
import { useEffect, useState } from "react";

const settingsSchema = z.object({
  autoReminders: z.boolean().optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface SettingsResponse {
  autoReminders?: boolean;
}
interface SettingsResponseData {
  message?: string;
  settings: SettingsResponse;
}

async function updatePreferences(
  formData: SettingsFormData,
  apiClient: AxiosInstance,
): Promise<SettingsResponseData> {
  try {
    const { data } = await apiClient.put("/preferences", {
      settings: { ...formData },
    });
    return data;
  } catch (error) {
    logger.error(`error updating user preferences ${error}`);
    throw error;
  }
}

async function fetchPreferences(apiClient: AxiosInstance) {
  logger.debug(`fetching user preferences`);
  try {
    const { data } = await apiClient.get("/preferences");
    return data;
  } catch (error) {
    logger.error(`error fetching preferences ${error}`);
    throw error;
  }
}

export default function SettingsPage() {
  const apiClient = useAxios();
  const { user } = useAuth();
  const { notificationsAllowed, setNotificationsAllowed } = useNotifications();
  const { isDark } = useTheme();

  const [settings, setSettings] = useState<SettingsResponse | null>(null);

  async function handleCheckChanged(checked: boolean) {
    if (checked) {
      const success = await requestNotificationPermission(apiClient);
      if (success)
        toast({
          title: "Success",
          description: "Subscribed to push notifications",
        });
    }
    browserStore.set("notificationsAllowed", checked.toString());
    setNotificationsAllowed(checked);
  }

  const { data, isError, isSuccess, error } = useQuery<
    { settings: SettingsResponse },
    AxiosError<APIErrorResponse>
  >({
    queryKey: ["settings"],
    queryFn: () => fetchPreferences(apiClient),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (isSuccess && data) {
      setSettings(data.settings);
    }
  }, [isSuccess, data]);

  useEffect(() => {
    if (isError && error) {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        "Error fetching preferences. Reload the page";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  }, [isError, error]);

  const { handleSubmit, control, reset } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      autoReminders: false,
    },
  });

  useEffect(() => {
    if (settings !== null) {
      reset({
        autoReminders: settings.autoReminders ?? false,
      });
    }
  }, [settings, reset]);

  const mutation = useMutation<
    SettingsResponseData,
    AxiosError<APIErrorResponse>,
    SettingsFormData
  >({
    mutationFn: (formData) => {
      return updatePreferences(formData, apiClient);
    },
    onSuccess: ({ message }) => {
      toast({
        title: "Success",
        description: message,
      });
    },
    onError: (error) => {
      const message =
        error.response?.data?.message || "Failed to update preferences";
      toast({
        title: error.response?.data?.error,
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (formData: SettingsFormData) => {
    mutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="p-4 space-y-6 max-w-2xl mx-auto">
        {/* Page Heading */}
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* User Profile Section */}
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <Avatar className="w-20 h-20">
            <AvatarFallback className="text-3xl">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </AvatarFallback>
          </Avatar>

          {/* Name & Email */}
          <div className="flex flex-col">
            <p className="text-xl font-semibold">{user?.name}</p>
            <p className="text-gray-600 mt-1">{user?.email}</p>
          </div>
        </div>

        {/* Appearance */}
        {/* Theme Row */}
        <div className="flex justify-between items-center">
          <span className="lg:text-lg">Theme</span>
          <span className="lg:text-lg">{isDark ? "Dark" : "Light"}</span>
        </div>

        {/* Push Notifications Row */}
        <div className="flex justify-between items-center">
          <span className="lg:text-lg">Push Notifications</span>
          <Switch
            checked={notificationsAllowed}
            disabled={notificationsAllowed}
            onCheckedChange={handleCheckChanged}
          />
        </div>

        {/* Auto-Reminders Row */}
        <div className="flex justify-between items-center">
          <span className="lg:text-lg">Auto-Reminders</span>
          <Controller
            control={control}
            name="autoReminders"
            render={({ field }) => (
              <Switch
                id="auto-reminders"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
              />
            )}
          />
        </div>

        <div className="mt-8">
          <Button className="w-full">Save Changes</Button>
        </div>
      </div>
    </form>
  );
}
