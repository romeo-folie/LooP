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

export function useAxios(): AxiosInstance {
  const { accessToken, localLogout } = useAuth();

  // Memoize the Axios instance so we don't recreate it on every render
  const axiosInstance = useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_SERVER_URL,
      withCredentials: true,
    });

    instance.interceptors.request.use((config) => {
      logger.info({ method: config.method, url: config.url }, "API Request");
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-TOKEN'] = csrfToken;
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
        if (error.response?.status === 401) localLogout();
        return Promise.reject(error);
      }
    );

    return instance;
  }, [accessToken, localLogout]);

  return axiosInstance;
}
