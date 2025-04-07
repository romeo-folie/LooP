import { toast } from "@/hooks/use-toast";
import { Label } from "./ui/label";
import React from "react";
import { Button } from "./ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./ui/card";
import { Input } from "./ui/input";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useAuth, User } from "@/context/auth-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { AxiosError, AxiosInstance } from "axios";
import PasswordInput from "./password-input";
import { Loader2 } from "lucide-react";
import { useAxios, APIErrorResponse } from "@/hooks/use-axios";
import { logger } from "@/lib/logger";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

interface SigninResponse {
  message: string;
  token: string;
  user: User;
}

const signInSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/\d/, "Password must contain at least one digit")
    .regex(
      /[!@#$%^&*(),.?":{}|<>]/,
      "Password must contain at least one special character (@$!%*?&)"
    ),
});

type SignInFormValues = z.infer<typeof signInSchema>;

const signInUser = async (
  userCredentials: SignInFormValues,
  apiClient: AxiosInstance
) => {
  try {
    const response = await apiClient.post("/auth/login", userCredentials);
    return response.data;
  } catch (error) {
    logger.error(`error logging in ${error}`)
    throw error;
  }
};

const handleGithubLogin = () => {
  window.location.href = `${SERVER_URL}/auth/github`;
};

const SigninForm: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const apiClient = useAxios();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    mode: "onChange",
  });

  const mutation = useMutation<
    SigninResponse,
    AxiosError<APIErrorResponse>,
    SignInFormValues
  >({
    mutationFn: (userCredentials: SignInFormValues) =>
      signInUser(userCredentials, apiClient),
    onSuccess: (data) => {
      login(data.user);

      toast({ title: "Success", description: "Signed in successfully!" });
      navigate("/");
    },
    onError: (error) => {
      const message = error.response?.data?.message || error.response?.data?.error || error.message  || "Sign in failed, please try again.";
      toast({ title: "Error", description: message, variant: "destructive" });
    },
  });

  const onSubmit = (data: SignInFormValues) => {
    mutation.mutate(data);
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-2xl xl:text-3xl">Welcome Back</CardTitle>
        <CardDescription>Please enter your details</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-2.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="abc@example.com"
                className="h-10 px-4"
                {...register("email")}
              />
            </div>
            <PasswordInput
              name="password"
              register={register}
              error={errors.password?.message}
            />
            <Button
              className="w-full"
              size="lg"
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin mr-2" />
              ) : (
                "Sign In"
              )}
            </Button>

            <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
              <span className="relative z-10 bg-background px-2 text-muted-foreground">
                or continue with
              </span>
            </div>
          </div>
        </CardContent>
      </form>
      <CardFooter className="flex flex-col gap-y-3">
        {/* <Button variant="outline" className="w-full" size="lg">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                      <path
                        d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                        fill="currentColor"
                      />
                    </svg>
                    Google
                  </Button> */}
        <Button
          variant="outline"
          className="w-full"
          size="lg"
          onClick={handleGithubLogin}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
              fill="currentColor"
            />
          </svg>
          GitHub
        </Button>
        <Button
          variant="link"
          className="ml-auto"
          onClick={
            () => navigate('/auth/forgot-password')
          }
        >
          Forgot your password?
        </Button>
      </CardFooter>
    </Card>
  );
};

export default SigninForm;
