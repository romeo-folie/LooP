import { Label } from "@radix-ui/react-label";
import { Eye, EyeClosed } from "lucide-react";
import React, { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { UseFormRegister } from "react-hook-form";


interface Props extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register?: UseFormRegister<any>;
}

const PasswordInput: React.FC<Props> = ({ label, register, error, ...props }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="flex flex-col space-y-1.5">
      <Label htmlFor={props.id || "password"}>{ label || "Password" }</Label>
      <div className="relative">
        <Input
          id={props.id || "password"}
          type={showPassword ? "text" : "password"}
          placeholder="e.g. P@s$w0rd"
          className="h-12 px-4 text-lg"
          {...(register ? register(props.name!) : {})}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-500 focus:outline-none focus:bg-transparent hover:bg-transparent"
        >
          {showPassword ? <EyeClosed /> : <Eye />}
        </Button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </div>
  );
};

export default PasswordInput;
