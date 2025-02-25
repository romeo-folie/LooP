import { Label } from "@radix-ui/react-label";
import React from "react";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Input } from "./ui/input";

const PasswordResetForm: React.FC = () => {
  return (
    <form>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-3xl">Reset Password</CardTitle>
          <CardDescription>
            Please enter the details below to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid w-full items-center gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="e.g. P@s$w0rd"
                className="h-12 px-4 text-lg"
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="confirm-new-password">Confirm Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                placeholder="e.g. P@s$w0rd"
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

export default PasswordResetForm;
