import { Label } from "./ui/label";
import React from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card";
import { Input } from "./ui/input";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";
import { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-provider";
import { logger } from "@/lib/logger";

export interface ForgotPasswordResponse {
  message: string;
}

const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export type ForgotPasswordFormValues = z.infer<typeof ForgotPasswordSchema>;

const ForgotPasswordForm: React.FC = () => {
  const navigate = useNavigate();
  const apiClient = useAxios();
  const { saveEmail } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const mutation = useMutation<
    ForgotPasswordResponse,
    AxiosError<APIErrorResponse>,
    ForgotPasswordFormValues
  >({
    mutationFn: async (emailData: ForgotPasswordFormValues) => {
      try {
        const { data } = await apiClient.post("/auth/forgot-password", emailData);
        return data;
      } catch (error) {
        logger.error("error submitting email", error);
        throw error;
      }

    },
    onSuccess: ({ message }) => {
      toast({
        title: "Success",
        description: message,
      });
      navigate("/auth/verify-otp");
    },
    onError: (error) => {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to send OTP";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: ForgotPasswordFormValues) => {
    saveEmail(values.email);
    mutation.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardHeader>
          <CardTitle className="text-xl 2xl:text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            Please enter the email address associated with your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-2.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="abc@example.com"
                className="h-12 px-4"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email.message}</p>
              )}
            </div>
            <Button
              className="w-full"
              size="lg"
              type="submit"
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

export default ForgotPasswordForm;
