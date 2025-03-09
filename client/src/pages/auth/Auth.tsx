import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SignupForm from "@/components/signup-form";
import { useNavigate, useLocation } from "react-router-dom";
import SigninForm from "@/components/sigin-form";
import { useEffect } from "react";

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
    <div className="bg-background text-foreground flex items-center justify-center h-screen w-screen">
        <Tabs
          className="w-[400px]"
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
    </div>
  );
};

export default Auth;
