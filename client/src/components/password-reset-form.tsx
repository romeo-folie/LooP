import React from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { useAxios, APIErrorResponse } from "@/hooks/use-axios";
import { toast } from "@/hooks/use-toast";
import { AxiosError } from "axios";
import { useAuth } from "@/context/auth-context";
import { Loader2 } from "lucide-react";
import PasswordInput from "./password-input";

interface PasswordResetResponse {
  message: string;
}

const PasswordResetSchema = z
  .object({
    new_password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/\d/, "Password must contain at least one digit")
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        "Password must contain at least one special character (@$!%*?&)"
      ),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type PasswordResetFormValues = z.infer<typeof PasswordResetSchema>;

type RequestValues = PasswordResetFormValues & {
  password_reset_token: string | null;
};

const PasswordResetForm: React.FC = () => {
  const navigate = useNavigate();
  const apiClient = useAxios();
  const { passwordResetToken, savePasswordResetToken } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RequestValues>({
    resolver: zodResolver(PasswordResetSchema),
  });

  const mutation = useMutation<
    PasswordResetResponse,
    AxiosError<APIErrorResponse>,
    RequestValues
  >({
    mutationFn: async (passwordResetData: RequestValues) => {
      const { data } = await apiClient.post(
        "/auth/reset-password",
        passwordResetData
      );
      return data;
    },
    onSuccess: ({ message }) => {
      toast({
        title: "Success",
        description: message,
      });
      savePasswordResetToken(null);
      navigate("/auth");
    },
    onError: (error) => {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to reset password";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (passwordResetData: RequestValues) => {
    passwordResetData = Object.assign(passwordResetData, {
      password_reset_token: passwordResetToken,
    });
    mutation.mutate(passwordResetData);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Reset Password</CardTitle>
          <CardDescription>
            Please enter the details below to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            {/* <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="e.g. P@s$w0rd"
                className="h-12 px-4 text-lg"
                {...register("new_password")}
              />
              {errors.new_password && (
                <p className="text-red-500 text-sm">
                  {errors.new_password.message}
                </p>
              )}
            </div> */}
            <PasswordInput
              label="New Password"
              id="new-password"
              name="new_password"
              className="h-12 px-4 text-lg"
              register={register}
              error={errors.new_password?.message}
            />
            {/* <div className="flex flex-col space-y-1.5">
              <Label htmlFor="confirm-new-password">Confirm Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="e.g. P@s$w0rd"
                className="h-12 px-4 text-lg"
                {...register("confirm_password")}
              />
              {errors.confirm_password && (
                <p className="text-red-500 text-sm">
                  {errors.confirm_password.message}
                </p>
              )}
            </div> */}
            <PasswordInput
              label="Confirm New Password"
              id="confirm-password"
              name="confirm_password"
              className="h-12 px-4 text-lg"
              register={register}
              error={errors.confirm_password?.message}
            />
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};

export default PasswordResetForm;
