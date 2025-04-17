import React from "react";

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Container: React.FC<ContainerProps> = ({ children, ...props }) => {
  return (
    <div
      className="bg-background text-foreground flex items-center justify-center min-h-screen w-screen py-8 overflow-x-hidden overflow-y-auto"
      {...props}
    >
      {children}
    </div>
  );
};

export default Container;
