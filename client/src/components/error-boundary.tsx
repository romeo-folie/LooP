import { logger } from "@/lib/logger";
import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error({ error, errorInfo }, "Unhandled error occurred");
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-background text-foreground flex flex-col items-center justify-center h-screen w-screen text-center">
          <h1 className="text-xl lg:text-2xl font-bold">
            Something went wrong.
          </h1>
          <p className="text-gray-500">Please reload the page.</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4 px-4"
          >
            Reload Page
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
