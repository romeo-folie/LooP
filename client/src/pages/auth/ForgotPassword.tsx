import React from "react";
import ForgotPasswordForm from "@/components/forgot-password-form";

const ForgotPassword: React.FC = () => {
  return (
    <div className="bg-background text-foreground flex items-center justify-center h-screen w-screen">
      <ForgotPasswordForm />
    </div>
  )
}

export default ForgotPassword;