import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import InputOTPForm from "@/components/otp-form";
import Container from "@/components/container";
import { useMediaQuery } from "@/hooks/use-media-query";

const VerifyOtp: React.FC = () => {
  const isMobile = useMediaQuery("(min-width: 320px) and (max-width: 480px)");

  return (
    <Container>
      <Card className={`${isMobile && "w-11/12"}`}>
        <CardHeader>
          <CardTitle className="text-2xl xl:text-3xl">
            One Time Password
          </CardTitle>
          <CardDescription>
            Please enter the 6 digit code sent to your email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InputOTPForm />
        </CardContent>
      </Card>
    </Container>
  );
};

export default VerifyOtp;
