import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./styles/index.css";
import App from "./App.tsx";
import ErrorBoundary from "./components/error-boundary.tsx";
import { NotificationProvider } from "./context/notification-provider.tsx";
import { NetworkStatusProvider } from "./context/network-status-provider.tsx";
import { ThemeProvider } from "@/context/theme-provider";
import { LoadingStatusProvider } from "./context/loading-status-provider.tsx";
import { AuthProvider } from "./context/auth-provider.tsx";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: "always",
    },
    mutations: {
      networkMode: "always",
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <NetworkStatusProvider>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
          <QueryClientProvider client={queryClient}>
            <NotificationProvider>
              <BrowserRouter>
                <AuthProvider>
                  <LoadingStatusProvider>
                    <App />
                  </LoadingStatusProvider>
                </AuthProvider>
              </BrowserRouter>
            </NotificationProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </NetworkStatusProvider>
    </ErrorBoundary>
  </StrictMode>
);
