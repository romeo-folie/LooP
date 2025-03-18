import { ThemeProvider } from "@/context/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/auth/Auth";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ProtectedRoute from "./components/protected-route";
import ProblemDashboard from "./pages/problems/ProblemDashboard";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyOtp from "./pages/auth/VerifyOtp";
import { toast } from "@/hooks/use-toast";
import { useEffect } from "react";

const App: React.FC = () => {
  useEffect(() => {
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        const { type, payload } = event.data || {};

        if (type === "IN_APP_ALERT") {
          toast({
            title: payload.title,
            description: payload.body,
          });
        }
      });
    }
  }, []);

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/verify-otp" element={<VerifyOtp />} />
        <Route path="/auth/password-reset" element={<ResetPassword />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/problems" />} />
          <Route path="/dashboard" element={<Navigate to="/problems" />} />
          <Route path="/problems" element={<ProblemDashboard />} />
        </Route>
      </Routes>
      <Toaster />
    </ThemeProvider>
  );
};

export default App;
