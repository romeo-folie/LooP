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
import { useAuth } from "@/context/auth-context";
import { useMutation } from "@tanstack/react-query";
import { APIErrorResponse, useAxios } from "@/hooks/use-axios";
import {
  ForgotPasswordFormValues,
  ForgotPasswordResponse,
} from "./forgot-password-form";
import { AxiosError } from "axios";

const FormSchema = z.object({
  pin: z.string().min(6, {
    message: "Your one-time password must be 6 characters.",
  }),
});

const InputOTPForm: React.FC = () => {
  const navigate = useNavigate();
  const apiClient = useAxios();
  const { email } = useAuth();

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      pin: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    navigate("/auth/password-reset");
    toast({
      title: "You submitted the following values:",
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  const resendOtpMutation = useMutation<
    ForgotPasswordResponse,
    AxiosError<APIErrorResponse>,
    ForgotPasswordFormValues
  >({
    mutationFn: async (emailData: ForgotPasswordFormValues) => {
      const { data } = await apiClient.post("/auth/forgot-password", emailData);
      return data;
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
      console.log("Error ", message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleResendClick = () => {
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
                <Button variant="link" onClick={handleResendClick}>
                  Resend OTP
                </Button>
              </FormDescription>
              {/* <FormMessage>Entered wrong OTP value</FormMessage> */}
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={pinValue.length !== 6}
        >
          Submit
        </Button>
      </form>
    </Form>
  );
};

export default InputOTPForm;
