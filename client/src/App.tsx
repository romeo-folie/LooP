import { ThemeProvider } from "@/context/theme-provider";
import Auth from "./pages/Auth";
import { Toaster } from "@/components/ui/toaster";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/protected-route";
import ProblemDashboard from "./pages/ProblemDashboard";

const App: React.FC = () => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/auth" element={<Auth />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/problems" />} />
          <Route path="/problems" element={<ProblemDashboard />} />
        </Route>
      </Routes>
      <Toaster />
    </ThemeProvider>
  );
};

export default App;
