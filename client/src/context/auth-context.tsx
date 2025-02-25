import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;

interface AuthContextType {
  accessToken: string | null;
  login: (token: string) => void;
  logout: () => Promise<void>;
  localLogout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const navigate = useNavigate();

  const bc = useMemo(() => new BroadcastChannel("auth"), []);

  const localLogout = useCallback(() => {
    setAccessToken(null);
    navigate("/auth?tab=sign-in");
  }, [navigate]);

  useEffect(() => {
    bc.onmessage = (event) => {
      if (event.data?.type === "LOGOUT") {
        console.log("Logout broadcast received. Logging out in this tab.");
        localLogout();
      }
    };

    return () => {
      bc.close();
    };
  }, [bc, localLogout]);

  const logout = useCallback(async () => {
    try {
      await axios.post(`${SERVER_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (error: unknown) {
      console.warn("Logout API call failed, but continuing logout.", error instanceof Error ? error.message : error);
    }

    localLogout();
    bc.postMessage({ type: "LOGOUT" }); // notify other tabs
  }, [bc, localLogout]);


  const login = (token: string) => {
    setAccessToken(token);
  };


  const refreshToken = useCallback(async () => {
    try {
      const response = await axios.post(
        `${SERVER_URL}/api/auth/refresh-token`,
        {},
        { withCredentials: true }
      );
      const newToken = response.data.token;
      setAccessToken(newToken);
      if (window.location.pathname.startsWith("/auth")) {
        navigate("/");
      }
    } catch (error: unknown) {
      console.log("No valid refresh token or refresh failed => staying logged out", error instanceof Error ? error.message : error);
      setAccessToken(null);
    }
  }, [navigate]);

  useEffect(() => {
    // On mount/new tab => try to get an access token using refresh cookie
    refreshToken();
  }, [refreshToken]);


  useEffect(() => {
    if (!accessToken) return;

    const decodeJwt = (token: string) => {
      try {
        return JSON.parse(atob(token.split(".")[1]));
      } catch {
        return null;
      }
    };

    const decoded = decodeJwt(accessToken);
    if (!decoded || !decoded.exp) return;

    const expiresIn = decoded.exp * 1000 - Date.now();
    const refreshBefore = expiresIn - 60000; // 1 min before expiry

    let timeoutId: ReturnType<typeof setTimeout>;
    if (refreshBefore > 0) {
      timeoutId = setTimeout(refreshToken, refreshBefore);
    } else {
      refreshToken(); // refresh immediately if token is close to or past expiry
    }

    return () => clearTimeout(timeoutId);
  }, [accessToken, refreshToken]);


  const value: AuthContextType = {
    accessToken,
    login,
    logout,
    localLogout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
