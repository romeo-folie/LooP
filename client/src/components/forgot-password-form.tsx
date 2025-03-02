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

const ForgotPasswordForm: React.FC = () => {
  return (
    <form>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-3xl">Forgot Password</CardTitle>
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
                className="h-12 px-4 text-lg"
              />
            </div>
            <Button
              className="w-full"
              size="lg"
              // onClick={() => {
                // setForgotPassword(false);
                // setProvidingOTP(true);
              // }}
            >
              Submit
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
};

export default ForgotPasswordForm;
