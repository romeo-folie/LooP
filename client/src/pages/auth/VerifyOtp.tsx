import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import InputOTPForm from "@/components/otp";
import Container from "@/components/container";

const VerifyOtp: React.FC = () => {
  return (
    <Container>
      <Card>
          <CardHeader>
            <CardTitle className="text-3xl">One Time Password</CardTitle>
            <CardDescription>
              Please enter the 6 digit code sent to your email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InputOTPForm />
          </CardContent>
        </Card>
    </Container>
  )
}

export default VerifyOtp;