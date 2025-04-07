"use client";

import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-provider";
import { useMutation } from "@tanstack/react-query";
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";
import {
  ForgotPasswordFormValues,
  ForgotPasswordResponse,
} from "./forgot-password-form";
import { AxiosError } from "axios";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { logger } from "@/lib/logger";

interface VerifyOtpResponse {
  message: string;
  password_reset_token: string;
}
const FormSchema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

type FormSchemaValues = z.infer<typeof FormSchema>;

type RequestValues = FormSchemaValues & { email: string | null };

const InputOTPForm: React.FC = () => {
  const [otpError, setOtpError] = useState<string | null>(null);
  const navigate = useNavigate();
  const apiClient = useAxios();
  const { email, savePasswordResetToken } = useAuth();

  const form = useForm<RequestValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: "",
    },
  });

  const mutation = useMutation<
    VerifyOtpResponse,
    AxiosError<APIErrorResponse>,
    RequestValues
  >({
    mutationFn: async (otpData: RequestValues) => {
      try {
        const { data } = await apiClient.post("/auth/verify-otp", otpData);
        return data;
      } catch (error) {
        logger.error(`error submitting otp for verification ${error}`)
        throw error;
      }

    },
    onSuccess: ({ message, password_reset_token }) => {
      savePasswordResetToken(password_reset_token);
      toast({ title: "Success", description: message });
      navigate("/auth/password-reset");
    },
    onError: (error) => {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "OTP Verification Failed";
      setOtpError(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const onSubmit = (otpData: RequestValues) => {
    otpData = Object.assign(otpData, { email });
    mutation.mutate(otpData);
  };

  const resendOtpMutation = useMutation<
    ForgotPasswordResponse,
    AxiosError<APIErrorResponse>,
    ForgotPasswordFormValues
  >({
    mutationFn: async (emailData: ForgotPasswordFormValues) => {
      try {
        const { data } = await apiClient.post("/auth/forgot-password", emailData);
        return data;
      } catch (error) {
        logger.error(`error requesting otp resend ${error}`);
        throw error;
      }

    },
    onSuccess: ({ message }) => {
      toast({
        title: "Success",
        description: message,
      });
    },
    onError: (error) => {
      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        "Failed to resend OTP";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleResendClick = () => {
    form.reset({ pin: "" });
    setOtpError(null);
    resendOtpMutation.mutate({ email: email! });
  };

  const pinValue = form.watch("pin");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <FormField
          control={form.control}
          name="pin"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <InputOTP maxLength={6} {...field} className="w-full">
                  <InputOTPGroup className="w-full flex justify-between gap-2">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="h-12 w-12 text-xl flex-1 border border-gray-500 rounded-md text-center"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormDescription className="flex justify-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={handleResendClick}
                >
                  Resend OTP
                </Button>
              </FormDescription>
              {otpError && <FormMessage>{otpError}</FormMessage>}
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={pinValue.length !== 6 || mutation.isPending}
        >
          {mutation.isPending ? (
            <Loader2 className="animate-spin mr-2" />
          ) : (
            "Submit"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default InputOTPForm;
