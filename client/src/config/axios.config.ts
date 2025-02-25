import { useAuth } from "@/context/auth-context";
import axios, { InternalAxiosRequestConfig } from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

// expected error response structure
export interface APIErrorResponse {
  message: string;
}

export const apiClient = axios.create({
  baseURL: SERVER_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuth();
    if (accessToken) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);