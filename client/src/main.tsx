import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/auth-provider.tsx";
import ErrorBoundary from "./components/error-boundary.tsx";
import { NotificationProvider } from "./context/notification-provider.tsx";
import { NetworkStatusProvider } from "./context/network-status-provider.tsx";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <NetworkStatusProvider>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <NotificationProvider>
                <App />
              </NotificationProvider>
            </AuthProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </NetworkStatusProvider>
    </ErrorBoundary>
  </StrictMode>
);
