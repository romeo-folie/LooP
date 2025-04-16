import React from "react";
import ForgotPasswordForm from "@/components/forgot-password-form";
import Container from "@/components/container";
import BackButton from "@/components/back-button";
import { useMediaQuery } from "@/hooks/use-media-query";

const ForgotPassword: React.FC = () => {
  const isMobile = useMediaQuery("(min-width: 320px) and (max-width: 480px)");

  return (
    <Container>
      {isMobile && <BackButton className="absolute top-4 left-4" />}

      <ForgotPasswordForm />
    </Container>
  );
};

export default ForgotPassword;
