import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

const ErrorScreen: React.FC<{ onReload?: () => void }> = ({ onReload }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-background text-foreground flex flex-col items-center justify-center h-screen w-screen text-center overflow-hidden">
      <h1 className="text-xl lg:text-2xl font-bold">Something went wrong.</h1>
      <p className="text-gray-500">Please reload the page.</p>
      <Button
        onClick={() => {
          navigate("/", { replace: true });
          if (onReload) onReload();
        }}
        className="mt-4 px-4"
      >
        Reload Page
      </Button>
    </div>
  );
};

export default ErrorScreen;
