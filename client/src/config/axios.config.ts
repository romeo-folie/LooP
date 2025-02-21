import axios from "axios";

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