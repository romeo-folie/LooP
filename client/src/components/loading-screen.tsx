import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";

export default function LoadingScreen() {
  const [progress, setProgress] = useState(20);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 10)); // Loop after reaching 100%
    }, 300);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center fixed inset-0 z-[9998] justify-center w-screen h-screen overflow-hidden bg-background">
      <Progress value={progress} className="w-48 z-[9999]" />
    </div>
  );
}
