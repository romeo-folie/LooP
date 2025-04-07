import axios, { AxiosInstance } from "axios";
import { useMemo } from "react";
import { useAuth } from "@/context/auth-provider";
import { logger } from "@/lib/logger";
import { getCsrfToken } from "@/lib/cookies";

export interface APISuccessResponse {
  message: string;
}
export interface APIErrorResponse {
  message?: string;
  error?: string;
}

export function createAxiosInstance(accessToken: string | null, logoutFn?: () => void) {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL,
    withCredentials: true,
    timeout: 5000,
    timeoutErrorMessage: "Request timed out",
  });

  instance.interceptors.request.use((config) => {
    logger.info({ method: config.method, url: config.url }, "API Request");
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const csrfToken = getCsrfToken();
    if (csrfToken) {
      config.headers["X-CSRF-TOKEN"] = csrfToken;
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      logger.info(
        { status: response.status, url: response.config.url },
        "API Response"
      );
      return response;
    },
    (error) => {
      logger.error(
        {
          error: error.response?.data?.message || error.response?.data?.error,
          url: error.config?.url,
        },
        "API Error"
      );
      if (error.response?.status === 401) {
        if (logoutFn) logoutFn()
      }
      return Promise.reject(error);
    }
  );

  return instance;
}

export function useAxios(): AxiosInstance {
  const { accessToken, localLogout } = useAuth();

  const axiosInstance = useMemo(() => {
    return createAxiosInstance(accessToken, localLogout);
  }, [accessToken, localLogout]);

  return axiosInstance;
}
