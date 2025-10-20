import axios, { AxiosInstance } from "axios";
import { logger } from "@/lib/logger";

export function createAxiosInstance(
  accessToken: string | null,
  csrfToken: string | null,
  logoutFn?: () => void,
): AxiosInstance {
  const instance = axios.create({
    baseURL: import.meta.env.VITE_SERVER_URL,
    withCredentials: true,
    timeout: 15000,
    timeoutErrorMessage: "Request timed out",
  });

  instance.interceptors.request.use((config) => {
    logger.debug("API Request", { method: config.method, url: config.url });
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    if (csrfToken) {
      config.headers["X-CSRF-TOKEN"] = csrfToken;
    }

    return config;
  });

  instance.interceptors.response.use(
    (response) => {
      logger.debug("API Response", {
        status: response.status,
        url: response.config.url,
      });
      return response;
    },
    (error) => {
      logger.error("API Error", {
        error: error.response?.data?.message || error.response?.data?.error,
        url: error.config?.url,
      });
      if (error.response?.status === 401) {
        if (logoutFn) logoutFn();
      }
      return Promise.reject(error);
    },
  );

  return instance;
}
