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

const NetworkStatusContext = createContext<
  NetworkStatusContextType | undefined
>(undefined);

export const useNetworkStatus = () => {
  const context = useContext(NetworkStatusContext);

  if (!context) {
    throw new Error(
      "useNetworkStatus must be used within a NetworkStatusProvider",
    );
  }

  return context;
};

export const NetworkStatusProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    const handleOnline = () => {
      logger.info("device online");
      setIsOnline(true);
      timer = setTimeout(() => {
        logger.info("triggered outbox sync");
        navigator.serviceWorker.controller?.postMessage({
          type: "SYNC_OUTBOX",
        });
      }, 20000);
    };

    const handleOffline = () => {
      logger.info("device offline");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const value: NetworkStatusContextType = {
    isOnline,
  };

  return (
    <NetworkStatusContext.Provider value={value}>
      {children}
    </NetworkStatusContext.Provider>
  );
};
