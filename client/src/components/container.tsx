import React from "react";

interface ContainerProps {
  children: React.ReactNode;
}

const Container: React.FC<ContainerProps> = ({ children }) => {
  return (
    <div className="bg-background text-foreground flex items-center justify-center h-screen w-screen">
      {children}
    </div>
  );
}

export default Container;