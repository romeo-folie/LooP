import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@radix-ui/react-icons";

const BackButton: React.FC<React.HTMLAttributes<HTMLButtonElement>> = ({ ...props }) => {
  const navigate = useNavigate();

  return (
    <Button variant="outline" size="icon" onClick={() => navigate(-1)} {...props}>
      <ArrowLeftIcon />
    </Button>
  );
};

export default BackButton;
