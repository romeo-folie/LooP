import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import React from "react"


const ProblemDashboard: React.FC = () => {
  const { logout } = useAuth();

  return (
    <div className="flex justify-center items-center h-screen w-screen">
      <div className="flex-col space-y-2">
        <h1>Problem Dashboard</h1>
        <Button className="w-full" size="lg" onClick={logout}>Logout</Button>
      </div>
    </div>
  )
}

export default ProblemDashboard;