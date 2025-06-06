import { createContext, useContext, ReactNode } from "react";
import LoadingScreen from "@/components/loading-screen";
import { useIsFetching } from "@tanstack/react-query";

interface LoadingContextType {
  isLoading: boolean;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const useLoader = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error("useLoader must be used within a LoadingStatusProvider");
  }
  return context;
};

export const LoadingStatusProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const isFetching = useIsFetching();

  const isLoading = isFetching > 0;

  const value: LoadingContextType = {
    isLoading,
  };

  return (
    <LoadingContext.Provider value={value}>
      {isLoading && <LoadingScreen />}
      {children}
    </LoadingContext.Provider>
  );
};
