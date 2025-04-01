import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";

export default function LoadingScreen() {
  const [progress, setProgress] = useState(50);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 10)); // Loop after reaching 100%
    }, 300); 

    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="flex items-center justify-center h-screen w-screen overflow-hidden z-50">
      <Progress value={progress} className="w-48" />
    </div>
  );
}
