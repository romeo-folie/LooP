import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import axios, { AxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { logger } from "@/lib/logger";
import browserStore from "@/lib/browser-storage";
import { encrypt, generateKey } from "@/lib/web-crypto";
import { getMeta, setMeta } from "@/lib/db";
import { getCsrfToken } from "@/lib/cookies";
import ErrorScreen from "@/components/error-screen";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
export interface User {
  user_id: number;
  name: string;
  email: string;
  token?: string | Uint8Array<ArrayBuffer>;
  iv?: Uint8Array<ArrayBuffer>;
  csrfToken?: string | null;
}
interface AuthContextType {
  accessToken: string | null;
  csrfToken: string | null;
  passwordResetToken: string | null;
  isAuthLoading: boolean;
  user: User | null;
  login: (user: User) => void;
  email: string | null;
  saveEmail: (email: string) => void;
  savePasswordResetToken: (token: string | null) => void;
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
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [passwordResetToken, setPasswordResetToken] = useState<string | null>(
    null,
  );
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const storedEmail = browserStore.get("forgotPasswordEmail");
  const [email, setEmail] = useState<string | null>(storedEmail);
  const [authError, setAuthError] = useState<string | null>(null);

  const navigate = useNavigate();

  const bc = useMemo(() => new BroadcastChannel("auth"), []);

  const encryptAccessToken = async function (token: string) {
    try {
      const key = await generateKey();
      const exportedKey = await window.crypto.subtle.exportKey("jwk", key);
      await setMeta("exportedKey", exportedKey);
      const { iv, ciphertext } = await encrypt(token, key);
      return { iv, token: ciphertext };
    } catch (error) {
      logger.error(`Error encrypting access token ${error}`);
    }
  };

  const saveUserLocally = useCallback(async function (user: User) {
    try {
      const encryptedData = await encryptAccessToken(user.token as string);
      if (!encryptedData) throw new Error("Failed to encrypt access token");
      user = Object.assign(
        { ...user },
        { token: encryptedData.token, iv: encryptedData.iv },
      );
      await setMeta("user", user);
    } catch (error) {
      logger.error(`Error saving user locally ${error}`);
    }
  }, []);

  const updateLocalTokens = useCallback(
    async function (token: string, csrf: string) {
      try {
        let user = await getMeta("user");
        if (!user) throw new Error("Failed to retrieve local user");
        user = Object.assign({ ...user }, { token, csrfToken: csrf });
        await saveUserLocally(user as User);
      } catch (error) {
        logger.error(`Error updating local tokens ${error}`);
      }
    },
    [saveUserLocally],
  );

  const localLogout = useCallback(() => {
    setAccessToken(null);
    setIsAuthLoading(false);
    navigate("/auth?tab=sign-in");
  }, [navigate]);

  const retrieveLocalUser = useCallback(async () => {
    try {
      const storedUser = await getMeta("user");
      if (!storedUser) throw new Error("Failed to retrieve local user");
      setUser(storedUser as User);
    } catch (error) {
      logger.error(`Error setting user in memory ${error}`);
    }
  }, []);

  const refreshTokens = useCallback(async () => {
    try {
      setIsAuthLoading(true);
      const response = await axios.post(
        `${SERVER_URL}/auth/refresh-token`,
        {},
        { withCredentials: true },
      );
      const newToken = response.data.token;
      if (newToken) {
        const csrf = getCsrfToken();
        setAccessToken(newToken);
        setCsrfToken(csrf);
        await updateLocalTokens(newToken, csrf as string);
        await retrieveLocalUser();
      }
      if (window.location.pathname.startsWith("/auth")) {
        navigate("/");
      }
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.error || error.response?.data?.message
          : "failed to refresh token";
      logger.error(message);
      setAccessToken(null);
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, [navigate, retrieveLocalUser, updateLocalTokens]);

  const logout = useCallback(async () => {
    try {
      await axios.post(
        `${SERVER_URL}/auth/logout`,
        {},
        { withCredentials: true },
      );
      setUser(null);
      setMeta("user", null);
      setMeta("exportedKey", null);
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? error.response?.data?.error || error.response?.data?.message
          : "Logout API call failed, but continuing logout";
      logger.error(message);
    } finally {
      localLogout();
      bc.postMessage({ type: "LOGOUT" });
    }
  }, [bc, localLogout]);

  const login = useCallback(
    async (user: User) => {
      try {
        setIsAuthLoading(true);
        setAccessToken(user.token as string);
        const csrfToken = getCsrfToken();
        setCsrfToken(csrfToken);
        user.csrfToken = csrfToken;
        await saveUserLocally(user);
        navigate("/");
        await retrieveLocalUser();
        bc.postMessage({ type: "LOGIN" });
      } catch (error) {
        logger.error(`error logging in user ${user.email}, error: ${error}`);
        localLogout();
      } finally {
        setIsAuthLoading(false);
      }
    },
    [bc, localLogout, navigate, retrieveLocalUser, saveUserLocally],
  );

  const saveEmail = (email: string) => {
    browserStore.set("forgotPasswordEmail", email);
    setEmail(email);
  };

  const savePasswordResetToken = (token: string | null) => {
    setPasswordResetToken(token);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  useEffect(() => {
    bc.onmessage = (event) => {
      if (event.data?.type === "LOGOUT") {
        localLogout();
      }

      if (event.data?.type === "LOGIN") {
        refreshTokens();
      }
    };
  }, [bc, localLogout, navigate, refreshTokens]);

  useEffect(() => {
    async function handleGithubLogin() {
      if (location.pathname.includes("/auth/github/success")) {
        const params = new URLSearchParams(location.search);
        const encodedUser = params.get("user");

        if (encodedUser) {
          try {
            const decoded = decodeURIComponent(encodedUser);
            const userObj = JSON.parse(decoded);
            await login(userObj);
          } catch (error: unknown) {
            const message =
              error instanceof AxiosError
                ? error.response?.data?.error || error.response?.data?.message
                : "Failed to parse GitHub user data";
            logger.error(`Github auth failed. error: ${message}`);
          }
        }
      } else if (location.pathname === "/auth/github/error") {
        setAuthError("Github Oauth Failed");
      }
    }
    // If redirected from GitHub OAuth login
    handleGithubLogin();
  }, [navigate, bc, login]);

  useEffect(() => {
    // should only run on mount if user is in auth page
    if (location.pathname === "/auth" || !accessToken || !csrfToken)
      refreshTokens();
  }, [accessToken, csrfToken, refreshTokens]);

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
      timeoutId = setTimeout(refreshTokens, refreshBefore);
    } else {
      refreshTokens(); // refresh immediately if token is close to or past expiry
    }

    return () => clearTimeout(timeoutId);
  }, [accessToken, refreshTokens]);

  const value: AuthContextType = {
    user,
    email,
    accessToken,
    csrfToken,
    isAuthLoading,
    passwordResetToken,
    login,
    logout,
    saveEmail,
    localLogout,
    savePasswordResetToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {authError && <ErrorScreen onReload={clearAuthError} />}
      {children}
    </AuthContext.Provider>
  );
};
