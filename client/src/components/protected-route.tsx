import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/auth-provider";
import LoadingScreen from "./loading-screen";
import Navbar from "./navbar";

export default function ProtectedRoute() {
  const { accessToken, isAuthLoading } = useAuth();
  const location = useLocation();

  if (isAuthLoading) return <LoadingScreen />;

  if (!accessToken) {
    // If user isn't logged in, redirect to sign-in
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // If user is logged in, render child routes
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}
