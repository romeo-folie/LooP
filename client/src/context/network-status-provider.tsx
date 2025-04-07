import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { logger } from "@/lib/logger";

interface NetworkStatusContextType {
  isOnline: boolean;
}

const NetworkStatusContext = createContext<NetworkStatusContextType | undefined>(undefined)

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext)

  if (!context) {
    throw new Error(
      "useNetworkStatus must be used within a NetworkStatusProvider"
    );
  }

  return context;
}

export const NetworkStatusProvider = ({ children }: { children: ReactNode }) => {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info("triggered outbox sync");
      navigator.serviceWorker.controller?.postMessage({ type: "SYNC_OUTBOX" });
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)

    window.addEventListener("offline", handleOffline)

    return () => { 
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    }
  }, [])

  const value: NetworkStatusContextType = {
    isOnline,
  }

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  )
}