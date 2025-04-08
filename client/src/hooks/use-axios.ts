import { AxiosInstance } from "axios";
import { useMemo } from "react";
import { useAuth } from "@/context/auth-provider";
import { createAxiosInstance } from "@/lib/api-client";

export interface APISuccessResponse {
  message: string;
}
export interface APIErrorResponse {
  message?: string;
  error?: string;
}

export function useAxios(): AxiosInstance {
  const { accessToken, csrfToken, localLogout } = useAuth();

  const axiosInstance = useMemo(() => {
    return createAxiosInstance(accessToken, csrfToken, localLogout);
  }, [accessToken, csrfToken, localLogout]);

  return axiosInstance;
}
