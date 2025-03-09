import React from "react";
import PasswordResetForm from "@/components/password-reset-form";

const ResetPassword: React.FC = () => {
  return (
    <div className="bg-background text-foreground flex items-center justify-center h-screen w-screen">
      <PasswordResetForm />
    </div>
  )
}

export default ResetPassword;