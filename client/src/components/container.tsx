import React from "react";

interface ContainerProps {
  children: React.ReactNode;
}

const Container: React.FC<ContainerProps> = ({ children, ...props }) => {
  return (
    <div className="bg-background text-foreground flex items-center justify-center min-h-screen w-full py-8" {...props}>
      {children}
    </div>
  );
}

export default Container;