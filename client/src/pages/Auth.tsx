import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import InputOTPForm from "@/components/otp";
import SignupForm from "@/components/signup-form";
import { useNavigate, useLocation } from "react-router-dom";
import ForgotPasswordForm from "@/components/forgot-password-form";
import PasswordResetForm from "@/components/password-reset-form";
import SigninForm from "@/components/sigin-form";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [forgotPassword, setForgotPassword] = useState(false);
  const [providingOTP, setProvidingOTP] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);

  function handleOTPSubmit() {
    setResetPassword(false);
    setProvidingOTP(false);
  }

  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get("tab") || "sign-in";

  const handleTabChange = (value: string) => {
    navigate(`/auth?tab=${value}`, { replace: true });
  };

  return (
    <div className="bg-background text-foreground flex items-center justify-center h-screen w-screen">
      <Tabs className="w-[400px]" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 h-12">
          <TabsTrigger value="sign-in" className="py-2">
            Sign In
          </TabsTrigger>
          <TabsTrigger value="sign-up" className="py-2">
            Sign Up
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sign-in">
          {forgotPassword ? (
            <ForgotPasswordForm />
          ) : resetPassword ? (
            <PasswordResetForm />
          ) : providingOTP ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-3xl">One Time Password</CardTitle>
                <CardDescription>
                  Please enter the one-time password sent to your email
                </CardDescription>
              </CardHeader>
              <CardContent>
                <InputOTPForm onOTPSubmit={handleOTPSubmit} />
              </CardContent>
            </Card>
          ) : (
            <SigninForm />
          )}
        </TabsContent>
        <TabsContent value="sign-up">
          <SignupForm />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Auth;
