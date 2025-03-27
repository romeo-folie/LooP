import { ThemeProvider } from "@/context/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/auth/Auth";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ProtectedRoute from "./components/protected-route";
import ProblemDashboard from "./pages/problems/ProblemDashboard";
import ResetPassword from "./pages/auth/ResetPassword";
import VerifyOtp from "./pages/auth/VerifyOtp";

const App: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div vaul-drawer-wrapper="" className="bg-background">
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
      </div>
    </ThemeProvider>
  );
};

export default App;
