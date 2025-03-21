import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SignupForm from "@/components/signup-form";
import { useNavigate, useLocation } from "react-router-dom";
import SigninForm from "@/components/sigin-form";
import { useEffect } from "react";
import Container from "@/components/container";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get("tab") || "sign-in";

  useEffect(() => {
    navigate(`/auth?tab=${activeTab}`, {replace: true });
  }, [navigate, activeTab]);

  const handleTabChange = (value: string) => {
    navigate(`/auth?tab=${value}`, { replace: true });
  };

  return (
    <Container>
        <Tabs
          className="w-[360px] pt-16 md:w-[400px] md:pt-0 lg:w-[450px] xl:w-[480px]"
          value={activeTab}
          onValueChange={handleTabChange}
        >
          <TabsList className="grid w-full grid-cols-2 h-12">
            <TabsTrigger value="sign-in" className="py-2">
              Sign In
            </TabsTrigger>
            <TabsTrigger value="sign-up" className="py-2">
              Sign Up
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sign-in">
            <SigninForm />
          </TabsContent>
          <TabsContent value="sign-up">
            <SignupForm />
          </TabsContent>
        </Tabs>
    </Container>
  );
};

export default Auth;
