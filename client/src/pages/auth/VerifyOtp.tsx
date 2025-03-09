import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import InputOTPForm from "@/components/otp";

const VerifyOtp: React.FC = () => {
  return (
    <div className="bg-background text-foreground flex items-center justify-center h-screen w-screen">
      <Card>
          <CardHeader>
            <CardTitle className="text-3xl">One Time Password</CardTitle>
            <CardDescription>
              Please enter the one-time password sent to your email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InputOTPForm />
          </CardContent>
        </Card>
    </div>
  )
}

export default VerifyOtp;