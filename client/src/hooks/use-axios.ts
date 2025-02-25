import axios, { AxiosInstance } from "axios";
import { useMemo } from "react";
import { useAuth } from "@/context/auth-context";

export interface APIErrorResponse {
  message: string;
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
      if (accessToken && config.headers) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }
      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        // e.g., handle 401 unauthorized
        if (error.response?.status === 401) {
          console.log("Unauthorized - logging out");
          localLogout();
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, [accessToken, localLogout]);

  return axiosInstance;
}
